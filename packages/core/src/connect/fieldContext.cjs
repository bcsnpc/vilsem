// Field metadata only: never expose partitions, data sources or credentials.
function normalizeLocalMetadata(data) {
 const tableNames=new Map(data.tables.map(t=>[t.id,t.name]));
 const columnNames=new Map(data.columns.map(c=>[c.id,c.name]));
 const cardinality=v=>({1:'one',2:'many'})[v] || v || 'unknown';
 const direction=v=>({0:'automatic',1:'oneDirection',2:'bothDirections'})[v] || v || 'unknown';
 return {
  tables:data.tables.map(table=>({...table,columns:data.columns.filter(c=>c.tableId===table.id).map(c=>({...c,dataType:({1:'automatic',2:'string',6:'int64',8:'double',9:'dateTime',10:'decimal',11:'boolean',17:'binary',19:'unknown',20:'variant'})[c.dataType] || String(c.dataType)}))})),
  measures:data.measures.map(m=>({...m,table:tableNames.get(m.tableId)})),
  relationships:(data.relationships || []).map(edge=>({name:edge.name,fromTable:tableNames.get(edge.fromTableId),fromColumn:columnNames.get(edge.fromColumnId),toTable:tableNames.get(edge.toTableId),toColumn:columnNames.get(edge.toColumnId),fromCardinality:cardinality(edge.fromCardinality),toCardinality:cardinality(edge.toCardinality),cardinality:`${cardinality(edge.fromCardinality)}_to_${cardinality(edge.toCardinality)}`,direction:direction(edge.crossFilteringBehavior),crossFilter:direction(edge.crossFilteringBehavior),isActive:edge.isActive!==false})),
  ...(data.relationshipWarning?{relationshipWarning:data.relationshipWarning}:{}),
 };
}
module.exports={normalizeLocalMetadata};
