// DAX is parsed and bound by Analysis Services, never evaluated as JavaScript.
import { createModelFormatter } from '../shared/modelFormatting.js'
// This lexer preserves strings/comments and source positions for safe dependency
// expansion. Engine validation is still required before preview/commit.
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
const quoteTable = value => `'${String(value).replace(/'/g, "''")}'`
const quoteName = value => `[${String(value).replace(/\]/g, ']]')}]`
const key = value => String(value).toLocaleLowerCase('en-US')

export function lexDax(expression) {
  if (typeof expression !== 'string' || !expression.trim() || expression.length > 16000) throw Error('Measure expression must contain 1–16000 characters')
  const tokens = []
  let i = 0
  while (i < expression.length) {
    const start = i, c = expression[i]
    if (/\s/.test(c)) { i++; continue }
    if (expression.startsWith('//', i) || expression.startsWith('--', i)) { while(i < expression.length && expression[i] !== '\n') i++; continue }
    if (expression.startsWith('/*', i)) { const end = expression.indexOf('*/', i+2); if(end<0) throw Error('Unterminated DAX comment'); i=end+2; continue }
    if (c === '"' || c === "'" || c === '[') {
      const close = c === '[' ? ']' : c
      let value = '', closed = false; i++
      while(i < expression.length) {
        if(expression[i] === close) {
          if(expression[i+1] === close) { value += close; i+=2; continue }
          i++; closed=true; break
        }
        value += expression[i++]
      }
      if(!closed) throw Error('Unterminated DAX string or identifier')
      tokens.push({kind:c==='"'?'string':c==='['?'ref':'table',value,start,end:i}); continue
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(expression.slice(i))
    if(word) { i+=word[0].length; tokens.push({kind:'word',value:word[0],start,end:i}); continue }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(expression.slice(i))
    if(number) {i+=number[0].length; tokens.push({kind:'number',value:number[0],start,end:i}); continue}
    if(!'()+-*/^&|=<>!,{}.'.includes(c)) throw Error(`Unsupported DAX character ${JSON.stringify(c)} at ${i}`)
    tokens.push({kind:'symbol',value:c,start,end:++i})
  }
  const stack=[]
  for(const t of tokens) {
    if(t.kind!=='symbol')continue
    if(t.value==='(' || t.value==='{')stack.push(t.value)
    if(t.value===')' || t.value==='}')if(stack.pop()!==(t.value===')'?'(':'{'))throw Error('Unbalanced DAX parentheses or braces')
  }
  if(stack.length)throw Error('Unbalanced DAX parentheses or braces')
  // A spec contains expressions, never additional query statements.
  if(tokens.some(t=>t.kind==='word' && /^(DEFINE|EVALUATE|MEASURE|COLUMN|TABLE|ORDER|START|CREATE|ALTER|DELETE)$/i.test(t.value)))throw Error('Only a scalar DAX expression is allowed in a visual-scoped measure')
  return tokens
}

export function compileScopedMeasures(measures = {}, {schema, homeTable} = {}) {
  if(!measures || typeof measures!=='object' || Array.isArray(measures))throw Error('spec.measures must be an object of name: DAX expression')
  const entries=Object.entries(measures)
  if(entries.length>32)throw Error('At most 32 visual-scoped measures are supported')
  const locals=new Map(), tables=new Map(), modelMeasures=new Map(), columns=new Set()
  for(const table of schema?.tables || []) tables.set(key(table.name),table)
  for(const table of schema?.tables || [])for(const column of table.columns || [])columns.add(key(column.name))
  for(const measure of schema?.measures || [])modelMeasures.set(key(measure.name),measure)
  for(const [name,declaration] of entries) {
    const expression=typeof declaration==='string'?declaration:declaration?.expression
    const format=typeof declaration==='object'&&declaration!==null?declaration.format:undefined
    if(format!==undefined)createModelFormatter(format)
    if(!name.trim() || name.length>128 || forbidden.has(key(name)) || /[\r\n\0]/.test(name))throw Error(`Invalid visual-scoped measure name: ${name}`)
    if(locals.has(key(name)))throw Error(`Duplicate visual-scoped measure name: ${name}`)
    if(modelMeasures.has(key(name)))throw Error(`Visual-scoped measure cannot shadow a model measure: ${name}`)
    if(columns.has(key(name)))throw Error(`Visual-scoped measure name collides with a model column: ${name}; use a unique alias to preserve inline dependency semantics`)
    locals.set(key(name),{name,expression,format,tokens:lexDax(expression),dependencies:[],replacements:[]})
  }
  if(entries.length && schema && !tables.has(key(homeTable)))throw Error(`Unknown measure home table: ${homeTable}`)
  for(const local of locals.values()) {
    for(let i=0;i<local.tokens.length;i++) {
      const t=local.tokens[i], prev=local.tokens[i-1], next=local.tokens[i+1]
      const qualified=t.kind==='ref' && prev && (prev.kind==='table' || prev.kind==='word')
      const dependency=t.kind==='ref'?locals.get(key(t.value)):null
      if(dependency && (!qualified || key(prev.value)===key(homeTable))) {
        local.dependencies.push(dependency.name)
        local.replacements.push({start:qualified?prev.start:t.start,end:t.end,name:dependency.name}); continue
      }
      if(!schema)continue
      if(t.kind==='ref') {
        if(qualified) {
          const table=tables.get(key(prev.value))
          if(!table)throw Error(`Unknown table '${prev.value}' in measure ${local.name}`)
          const column=(table.columns || []).some(c=>key(c.name)===key(t.value))
          const measure=(schema.measures || []).some(m=>key(m.table)===key(table.name) && key(m.name)===key(t.value))
          if(!column && !measure)throw Error(`Unknown field '${prev.value}'[${t.value}] in measure ${local.name}`)
        } else if(!modelMeasures.has(key(t.value)) && !columns.has(key(t.value)))throw Error(`Unknown measure or column [${t.value}] in measure ${local.name}`)
      }
      if(t.kind==='table' && next?.kind!=='ref' && !tables.has(key(t.value)))throw Error(`Unknown table '${t.value}' in measure ${local.name}`)
      // Bare identifiers can be functions, keywords, variables or table names;
      // the engine resolves these authoritatively, including iterator scopes.
    }
  }
  const visiting=new Set(), expanded=new Map(), ordered=[]
  function expand(name) {
    const k=key(name), local=locals.get(k)
    if(expanded.has(k))return expanded.get(k)
    if(visiting.has(k))throw Error(`Visual-scoped measure dependency cycle at [${name}]`)
    visiting.add(k)
    let result=local.expression
    for(const replacement of [...local.replacements].sort((a,b)=>b.start-a.start)) {
      // Measure references introduce context transition inside iterators.
      result=result.slice(0,replacement.start)+`CALCULATE(\n${expand(replacement.name)}\n)`+result.slice(replacement.end)
      if(result.length>100000)throw Error('Expanded measure exceeds 100000 characters')
    }
    visiting.delete(k); expanded.set(k,result); ordered.push(local); return result
  }
  for(const local of locals.values())expand(local.name)
  return {
    definitions:ordered.map(local=>({name:local.name,expression:local.expression,expanded:expanded.get(key(local.name)),...(local.format!==undefined?{format:local.format}:{})})),
    define:entries.length?`DEFINE\n${ordered.map(local=>`  MEASURE ${quoteTable(homeTable || '__vilsem__')}${quoteName(local.name)} = ${local.expression}\n`).join('')}`:'',
    expression(name){return expanded.get(key(name))},
    format(name){return locals.get(key(name))?.format},
  }
}
