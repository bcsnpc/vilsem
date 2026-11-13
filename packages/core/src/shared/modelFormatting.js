// Bounded Power BI/Excel-style display formats. These are parsed as data;
// no format string is ever compiled as caller JavaScript.
function sections(format) {
  const result=[''];let quoted=false,escaped=false
  for(const c of format) {
    if(escaped){result[result.length-1]+=c;escaped=false;continue}
    if(c==='\\'){result[result.length-1]+=c;escaped=true;continue}
    if(c==='"')quoted=!quoted
    if(c===';'&&!quoted)result.push('');else result[result.length-1]+=c
  }
  if(quoted||escaped)throw Error('Invalid format string: unterminated literal or escape')
  if(result.length>4)throw Error('Format string supports at most four sections')
  return result
}
function unquote(text) {
  return text.replace(/"([^"]*)"|\\(.)|\[\$([^\]-]*)[^\]]*\]|\[[^\]]*\]|_.|\*./g,(_all,literal,escaped,currency)=>literal??escaped??currency??'')
}
function skeleton(text) { return text.replace(/"[^"]*"|\\.|\[[^\]]*\]/g,m=>' '.repeat(m.length)) }
function dateValue(value) {
  if(typeof value==='number')return new Date(Math.abs(value)<1e6?Date.UTC(1899,11,30)+value*86400000:value)
  return new Date(value)
}
function dateFormatter(pattern,value,locale) {
  const date=dateValue(value);if(!Number.isFinite(date.getTime()))return ''
  const literal=[]
  const protectedPattern=pattern.replace(/"([^"]*)"|\\(.)/g,(_m,a,b)=>`\u0001${literal.push(a??b)-1}\u0001`)
  const pad=n=>String(n).padStart(2,'0')
  const result=protectedPattern.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM/gi,(token,offset)=>{
    switch(token.toLowerCase()) {
      case 'yyyy':return String(date.getUTCFullYear());case 'yy':return pad(date.getUTCFullYear()%100)
      case 'mmmm':case 'mmm':return new Intl.DateTimeFormat(locale,{month:token.length===4?'long':'short',timeZone:'UTC'}).format(date)
      case 'mm':case 'm': {const minutes=/(?:h{1,2}:|:)$/.test(protectedPattern.slice(0,offset).toLowerCase());const n=minutes?date.getUTCMinutes():date.getUTCMonth()+1;return token.length===2?pad(n):String(n)}
      case 'dddd':case 'ddd':return new Intl.DateTimeFormat(locale,{weekday:token.length===4?'long':'short',timeZone:'UTC'}).format(date)
      case 'dd':return pad(date.getUTCDate());case 'd':return String(date.getUTCDate())
      case 'hh':case 'h':{let n=date.getUTCHours();if(/AM\/PM/i.test(pattern))n=n%12||12;return token.length===2?pad(n):String(n)}
      case 'ss':return pad(date.getUTCSeconds());case 's':return String(date.getUTCSeconds())
      default:return date.getUTCHours()<12?'AM':'PM'
    }
  })
  return result.replace(/\u0001(\d+)\u0001/g,(_m,i)=>literal[Number(i)])
}
export function createModelFormatter(format, { blank = '(Blank)', locale = 'en-US' } = {}) {
  try { if(typeof locale!=='string'||locale.length>64)throw Error();locale=Intl.getCanonicalLocales(locale)[0];if(!locale)throw Error() } catch { throw Error('Invalid formatting locale: use a BCP 47 locale such as en-US or en-IN') }
  if(format!=null&&(typeof format!=='string'||format.length>512))throw Error('Measure format must be a string of at most 512 characters')
  const aliases={percent:'0.00%',currency:'$#,0.00','whole number':'#,0','decimal number':'#,0.00','short date':'m/d/yyyy','long date':'dddd, mmmm d, yyyy'}
  const raw=aliases[String(format).toLowerCase()]??String(format||'General')
  const parts=sections(raw)
  return Object.assign(value=>{
    if(value==null||value===''||(typeof value==='number'&&!Number.isFinite(value)))return blank
    if(raw.toLowerCase()==='general')return typeof value==='number'?new Intl.NumberFormat(locale,{useGrouping:false,maximumSignificantDigits:10}).format(value):String(value)
    if(/[ydh]/i.test(skeleton(parts[0])) && !/[0#?]/.test(skeleton(parts[0])))return dateFormatter(parts[0],value,locale)
    const number=Number(value);if(!Number.isFinite(number))return String(value)
    const index=number<0&&parts.length>1?1:number===0&&parts.length>2?2:0
    const pattern=parts[index],plain=skeleton(pattern)
    const match=/[0#?][0#?,]*(?:\.[0#?]+)?(?:,+)?/.exec(plain)
    if(!match)return unquote(pattern)
    const percent=(plain.match(/%/g)||[]).length
    const [integerPart,fractionPart='']=match[0].split('.')
    const trailing=(integerPart.match(/,+$/)||[''])[0].length+(fractionPart.match(/,+$/)||[''])[0].length
    const numeric=integerPart.replace(/,+$/,'')
    const decimal=fractionPart.replace(/,+$/,'')
    const maximumFractionDigits=Math.min(20,decimal.length),minimumFractionDigits=Math.min(maximumFractionDigits,(decimal.match(/0/g)||[]).length)
    const scaled=Math.abs(number)*Math.pow(100,percent)/Math.pow(1000,trailing)
    const body=new Intl.NumberFormat(locale,{useGrouping:numeric.includes(','),minimumFractionDigits,maximumFractionDigits}).format(scaled)
    const prefix=unquote(pattern.slice(0,match.index)),suffix=unquote(pattern.slice(match.index+match[0].length))
    return (number<0&&index===0?'-':'')+prefix+body+suffix
  },{vilsemNumberStyle:numberStyle(raw,parts)})
}

// What a compact formatter may keep from a measure format: only its currency
// symbols. Unit literals such as "M" or "B" are dropped, because compact
// scaling supplies its own unit; percent/date/text formats are left alone.
function numberStyle(raw,parts) {
  if(raw.toLowerCase()==='general')return {kind:'general',prefix:'',suffix:''}
  const pattern=parts[0],plain=skeleton(pattern)
  if(/[ydh]/i.test(plain) && !/[0#?]/.test(plain))return {kind:'date',prefix:'',suffix:''}
  const match=/[0#?][0#?,]*(?:\.[0#?]+)?(?:,+)?/.exec(plain)
  if(!match)return {kind:'text',prefix:'',suffix:''}
  if(/%/.test(plain))return {kind:'percent',prefix:'',suffix:''}
  const currency=text=>(unquote(text).match(/\p{Sc}/u)||[''])[0]
  return {kind:'number',prefix:currency(pattern.slice(0,match.index)),suffix:currency(pattern.slice(match.index+match[0].length))}
}

export function scopedMeasureFormat(spec,name) {
  const measure=spec?.measures?.[name]
  return measure && typeof measure==='object' ? measure.format : undefined
}
