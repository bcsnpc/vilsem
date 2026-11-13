// Read-only model profiling for agent context. Values come from DAX, never from
// sample inference. Source/model definitions are deliberately not copied out.
const tableRef=name=>`'${String(name).replace(/'/g,"''")}'`
const columnRef=(table,column)=>`${tableRef(table)}[${String(column).replace(/\]/g,']]')}]`
const numericOrDate=type=>/^(int\d*|double|decimal|currency|number|date.*)$/i.test(type || '')
const value=(row,name)=>Object.entries(row || {}).find(([key])=>key.replace(/^\[|\]$/g,'').toLowerCase()===name.toLowerCase())?.[1]

export function columnProfileQuery(table,columns,{compositeSafe=false}={}) {
 if(!columns.length || columns.length>8)throw Error('A profile batch requires1..8 columns')
 const parts=['"__rows"',`COUNTROWS(${tableRef(table)})`]
 columns.forEach((column,i)=>{
  const ref=columnRef(table,column.name)
  const distinct=compositeSafe?`COUNTROWS(DISTINCT(SELECTCOLUMNS(${tableRef(table)}, "__vilsem_value", ${ref})))`:`DISTINCTCOUNT(${ref})`
  parts.push(`"c${i}Distinct"`,`COALESCE(${distinct},0)`,`"c${i}Blanks"`,`COALESCE(COUNTROWS(FILTER(${tableRef(table)},ISBLANK(${ref}))),0)`)
  if(numericOrDate(column.dataType))parts.push(`"c${i}Min"`,`MIN(${ref})`,`"c${i}Max"`,`MAX(${ref})`)
 })
 return `EVALUATE ROW(${parts.join(', ')})`
}

function fieldsOnly(schema) {
 return {
  tables:(schema.tables || []).map(t=>({name:t.name,isHidden:t.isHidden ?? false,columns:(t.columns || []).map(c=>({name:c.name,dataType:c.dataType || 'unknown',isHidden:c.isHidden ?? false,isKey:c.isKey ?? null,...(c.description?{description:c.description}:{}),...(c.displayFolder?{displayFolder:c.displayFolder}:{})}))})),
  measures:(schema.measures || []).map(m=>({name:m.name,table:m.table,expression:m.expression ?? null,formatString:m.formatString ?? null,displayFolder:m.displayFolder ?? null,description:m.description ?? null,isHidden:m.isHidden ?? false})),
  relationships:(schema.relationships || []).map(e=>({name:e.name,fromTable:e.fromTable,fromColumn:e.fromColumn,toTable:e.toTable,toColumn:e.toColumn,cardinality:e.cardinality,direction:e.direction || e.crossFilter || 'unknown',isActive:e.isActive!==false})),
  ...(schema.relationshipWarning?{relationshipWarning:schema.relationshipWarning}:{}),
 }
}

export function schemaDetail(schema,detail='summary') {
 if(!['summary','full'].includes(detail))throw Error('detail must be summary or full')
 if(detail==='full')return {...schema,detail}
 const {relationships,relationshipWarning,...summary}=schema
 return {...summary,detail,measures:schema.measures.map(({expression,...measure})=>measure)}
}

// Options keep agent context bounded on large models:
//  profile:false  names/types/measures only (no DAX profiling or sampling)
//  samples:false  skip distinct-sample queries entirely (not just hide them)
//  tables:[...]   profile only these tables (case-insensitive)
//  budgetMs       stop starting new profiling queries after this long; columns
//                 not reached say so, so the caller can ask for specific tables.
export async function enrichSchema(schema,query,{schemaOnly=false,profile=true,samples=true,tables=null,budgetMs=20000,now=()=>Date.now()}={}) {
 const result={...fieldsOnly(schema),samplingAsOf:new Date().toISOString(),statisticsDefinition:'Exact DAX cardinality includes BLANK; nullShare is the fraction of rows satisfying ISBLANK, null for an empty table. Samples contain up to10 distinct values and are not a population distribution.'}
 const tasks=[],wanted=Array.isArray(tables)&&tables.length?new Set(tables.map(t=>String(t).toLowerCase())):null
 for(const table of result.tables) {
  const eligible=[]
  for(const column of table.columns) {
   Object.assign(column,{cardinality:null,nullShare:null,min:null,max:null,sampleValues:[]})
   if(schemaOnly){column.profileSkipped='Schema-only connection; open the model and reconnect for live profiling';column.sampleSkipped=column.profileSkipped;continue}
   if(/^RowNumber-/.test(column.name)){column.sampleSkipped='Internal Analysis Services row identity is not queryable';column.profileSkipped=column.sampleSkipped;continue}
   if(!profile){column.profileSkipped='Not profiled (profile:false)';column.sampleSkipped=column.profileSkipped;continue}
   if(wanted&&!wanted.has(table.name.toLowerCase())){column.profileSkipped='Not profiled: table not in the requested tables';column.sampleSkipped=column.profileSkipped;continue}
   eligible.push(column)
   if(!samples){column.sampleSkipped='Samples not requested (samples:false)';continue}
   tasks.push(Object.assign(async()=>{
    const ref=columnRef(table.name,column.name)
    try {
     const rows=await query(`EVALUATE TOPN(10, VALUES(${ref}), ${ref}, ASC)`,10)
     column.sampleValues=rows.slice(0,10).map(row=>Object.values(row)[0])
    } catch(error) {
     if(/composite key/i.test(error.message))try {
      const rows=await query(`EVALUATE SELECTCOLUMNS(TOPN(10, ${tableRef(table.name)}, ${ref}, ASC), "__vilsem_sample", ${ref})`,10)
      column.sampleValues=[...new Set(rows.slice(0,10).map(row=>Object.values(row)[0]))];return
     }catch(fallback){error=fallback}
     column.sampleError=error.message
    }
   },{sampleColumn:column}))
  }
  for(let start=0;start<eligible.length;start+=8) {
   const columns=eligible.slice(start,start+8)
   tasks.push(Object.assign(async()=>{
    async function profileBatch(batch,compositeSafe=false) {
     const [row]=await query(columnProfileQuery(table.name,batch,{compositeSafe}),1)
     const count=value(row,'__rows'),rows=count===null?0:count
     if(!Number.isSafeInteger(rows)||rows<0)throw Error('Profile returned an invalid row count')
     batch.forEach((column,i)=>{
      const distinct=value(row,`c${i}Distinct`),blanks=value(row,`c${i}Blanks`)
      if(!Number.isSafeInteger(distinct)||distinct<0||distinct>rows||!Number.isSafeInteger(blanks)||blanks<0||blanks>rows){column.profileError='Profile did not return valid cardinality/blank counts';return}
      Object.assign(column,{cardinality:distinct,nullShare:rows?blanks/rows:null,min:numericOrDate(column.dataType)?value(row,`c${i}Min`) ?? null:null,max:numericOrDate(column.dataType)?value(row,`c${i}Max`) ?? null:null})
     })
    }
    try{await profileBatch(columns)}catch(error){
     // One inaccessible field must not erase the context for its neighbours.
     for(const column of columns)try{await profileBatch([column])}catch(failure){
      if(/composite key/i.test(failure.message))try{await profileBatch([column],true);continue}catch(fallback){failure=fallback}
      column.profileError=failure.message
     }
    }
   },{columns}))
  }
 }
 // Profile batches carry their columns so a budget stop can label what was skipped.
 const started=now(),budget=Number.isFinite(budgetMs)&&budgetMs>0?budgetMs:Infinity
 let next=0,stopped=false
 await Promise.all(Array.from({length:Math.min(4,tasks.length)},async()=>{while(next<tasks.length){
  if(now()-started>=budget){stopped=true;break}
  await tasks[next++]()
 }}))
 if(stopped){
  const note='Not profiled: time budget reached on a large model. Call get_schema with tables:["<table>"] to profile specific tables.'
  for(const task of tasks.slice(next)){
   for(const column of task.columns || [])if(column.cardinality===null&&!column.profileError)column.profileSkipped=note
   if(task.sampleColumn&&!task.sampleColumn.sampleValues.length&&!task.sampleColumn.sampleError)task.sampleColumn.sampleSkipped=note
  }
  result.profileIncomplete=`Profiling stopped after ${Math.round(budget/1000)} s; ${tasks.length-next} of ${tasks.length} profiling queries were not run. Columns marked profileSkipped were not profiled.`
 }
 return result
}
