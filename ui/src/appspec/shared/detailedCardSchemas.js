// Public formatting descriptors; tabs describe placement, not separate config stores.
const range = (key,label,group,value,min,max,tab='style') => ({key,label,group,type:'range',default:value,min,max,step:1,tab})
const color = (key,label,group,tab='style') => ({key,label,group,type:'color',default:'',tab})
const toggle = (key,label,group,value=true) => ({key,label,group,type:'boolean',default:value})
export const bulletFormatting = [
 {key:'targetValue',label:'Target value',group:'Scale & target',type:'number',nullable:true,min:0,max:1e12},
 {key:'maxValue',label:'Scale maximum',group:'Scale & target',type:'number',nullable:true,min:1,max:1e12},
 range('barHeight','Bar height','Value bar',12,2,40),range('barRadius','Bar corner radius','Value bar',3,0,20),color('barColor','Bar color','Value bar'),
 toggle('showTarget','Show target marker','Target marker'),range('targetWidth','Marker width','Target marker',2,1,10),color('targetColor','Marker color','Target marker'),
 range('trackRadius','Track corner radius','Track',4,0,20),
]
export const metricFormatting = [
 {key:'maxValue',label:'Target value',group:'Scale',type:'number',default:100,min:1,max:1e12},
 toggle('showRing','Show ring','Ring'),range('ringSize','Ring diameter','Ring',44,24,120),range('ringWidth','Ring stroke width','Ring',4,1,8),color('ringColor','Ring color','Ring'),color('ringTrackColor','Ring track color','Ring'),
 toggle('showPercentage','Show percentage','Ring'),range('percentageFontSize','Percentage size','Percentage',9,6,24,'text'),color('percentageColor','Percentage color','Percentage','text'),
 range('contentGap','Ring-to-value gap','Spacing',12,0,40),
]
export const statFormatting = [
 toggle('showTrend','Show comparison','Comparison'),range('comparisonGap','Value-to-comparison gap','Comparison',8,0,32),
 range('trendFontSize','Comparison size','Comparison text',11,8,24,'text'),color('trendUpColor','Positive color','Comparison text','text'),color('trendDownColor','Negative color','Comparison text','text'),
 range('trendDecimals','Comparison decimal places','Comparison text',1,0,4,'text'),
 range('subtitleFontSize','Subtitle size','Subtitle',10,8,32,'text'),color('subtitleColor','Subtitle color','Subtitle','text'),
 range('contentGap','Row spacing','Spacing',4,0,24),
]
export const progressFormatting = [
 color('barColor','Start color','Fill'),color('barEndColor','End color','Fill'),color('trackColor','Track color','Track'),
 range('percentageFontSize','Percentage size','Percentage',12,8,32,'text'),color('percentageColor','Percentage color','Percentage','text'),
 range('contentGap','Row spacing','Spacing',8,0,32),
]
