// UTC calendar conversion shared by date and interval shaping.
export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null
  const date=value.slice(0,10),ms=Date.parse(date+'T00:00:00Z')
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===date?ms:null
}
export function intervalDate(value) {
  if(typeof value==='number')return Number.isFinite(value)&&Number.isFinite(new Date(value).getTime())?value:null
  if(typeof value!=='string'||isoDate(value)==null)return null
  if(value.length===10)return isoDate(value)
  // Tabular DateTime is a timezone-free calendar value; ADOMD serializes seven
  // fractional digits without a zone. Interpret that wall clock in UTC so the
  // same model produces identical geometry on every host, never local DST.
  const parts=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|[+-]\d{2}:\d{2})?$/)
  if(!parts||Number(parts[2])>23||Number(parts[3])>59||Number(parts[4])>59)return null
  const zone=parts[6]??'Z'
  if(zone!=='Z'&&(Number(zone.slice(1,3))>14||Number(zone.slice(4))>59||(Number(zone.slice(1,3))===14&&Number(zone.slice(4))!==0)))return null
  const fraction=parts[5]?'.'+parts[5].padEnd(3,'0').slice(0,3):''
  const ms=Date.parse(`${parts[1]}T${parts[2]}:${parts[3]}:${parts[4]}${fraction}${zone}`)
  return Number.isFinite(ms)?ms:null
}
