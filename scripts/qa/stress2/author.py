"""Fresh stress-round authorship. Never reads or clones a shipped template.

The common frame is authored here; each case explicitly constructs its own
ECharts skeleton and real AdventureWorks field bindings from the captured schema.
Outputs remain pending evidence until the actual MCP + Desktop checks pass.
"""
import json
from pathlib import Path
from copy import deepcopy

OUT=Path('D:/vilsem-mcp/test-results/stress2')
SCHEMA=json.loads((OUT/'schema.json').read_text(encoding='utf-8'))
PENDING=OUT/'pending';PENDING.mkdir(exist_ok=True)
COLORS=['#2dd4bf','#60a5fa','#f59e0b','#f472b6','#a78bfa','#a3e635']
DATE=('Calendar Lookup','Date');MONTH=('Calendar Lookup','Start of Month')
CAT=('Product Categories Lookup','CategoryName');COUNTRY=('Territory Lookup','Country')
SUBCAT=('Product Subcategories Lookup','SubcategoryName')

def binding(dims,measures):
 for table,column in dims:
  assert any(t['name']==table and any(c['name']==column for c in t['columns']) for t in SCHEMA['tables']), (table,column)
 return {'dimensions':[{'table':t,'column':c} for t,c in dims],'measures':[{'table':'Measure Table','name':m} for m in measures]}

def frame(title,slots):
 return {'animation':False,'backgroundColor':'$theme.background','color':COLORS,
 'textStyle':{'color':'#e2e8f0','fontFamily':'Segoe UI'},
 'title':{'text':title,'left':18,'top':12,'textStyle':{'fontSize':17,'color':'#f8fafc'}},
 'legend':{'top':42,'textStyle':{'color':'#cbd5e1'}},'tooltip':{'trigger':'axis','confine':True},
 'grid':{'left':75,'right':40,'top':90,'bottom':75,'containLabel':True},
 'xAxis':{'type':'category','data':f'$slot.{next(iter(slots))}.values','axisLabel':{'color':'#cbd5e1','rotate':35,'hideOverlap':True},'axisLine':{'lineStyle':{'color':'#64748b'}}},
 'yAxis':{'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'},'splitLine':{'lineStyle':{'color':'#263244'}}}}

CASES=[]
def save(n,slug,title,dims,names,option,transforms=None,measures=None,slots=None,params=None):
 def match_legend(series):
  if isinstance(series,list):
   for entry in series:match_legend(entry)
  elif isinstance(series,dict):
   if 'repeat' in series:match_legend(series['template'])
   elif 'concat' in series:match_legend(series['concat'])
   elif series.get('type')=='line':
    color=series.get('lineStyle',{}).get('color') or series.get('areaStyle',{}).get('color')
    if color:series.setdefault('itemStyle',{}).setdefault('color',color)
 if n in (4,5) or n>12:match_legend(option.get('series'))
 if slots is None:slots={'date':{'kind':'time' if dims[0][0]=='Calendar Lookup' else 'dimension'}}|{f'm{i}':{'kind':'measure'} for i in range(len(names))}
 spec={'version':1,'type':'custom','canvasTheme':'dark','config':{'cardStyle':'plain'},'template':{'meta':{'id':f'stress2_{n:03}_{slug}','name':title,'description':title,'formatVersion':3 if n>=85 and n not in (87,88) else 2},'slots':slots,'params':params or [],'template':option}}
 if transforms:spec['template']['transforms']=transforms
 if measures:spec['measures']=measures
 file=f'{n:03}-{slug}.vilsem-visual.json';(PENDING/file).write_text(json.dumps(spec,indent=2),encoding='utf-8')
 CASES.append({'id':n,'slug':slug,'file':file,'description':title,'bindings':binding(dims,names),'pageName':f'stress2_a{(n-1)//12+1:02}','visualName':f'stress2_{n:03}_{slug}','layout':{'x':((n-1)%2)*900,'y':(((n-1)%12)//2)*600,'width':900,'height':600}})

def simple(title,count=1):
 slots={'date':{'kind':'time'}}|{f'm{i}':{'kind':'measure'} for i in range(count)}
 return slots,frame(title,slots)

s,o=simple('01 · Revenue step: start / middle / end',3)
o['series']=[{'type':'line','name':step,'step':step,'showSymbol':False,'data':f'$slot.m{i}.values'} for i,step in enumerate(['start','middle','end'])]
save(1,'step-line',o['title']['text'],[DATE],['Step Start','Step Middle','Step End'],o,measures={name:'[Total Revenue]' for name in ['Step Start','Step Middle','Step End']},slots=s)

s,o=simple('02 · Revenue spline with gradient')
o['series']=[{'type':'line','name':'Revenue','smooth':True,'showSymbol':False,'data':'$slot.m0.values','areaStyle':{'color':{'type':'linear','x':0,'y':0,'x2':0,'y2':1,'colorStops':[{'offset':0,'color':'#14b8a6cc'},{'offset':1,'color':'#14b8a600'}]}}}]
save(2,'spline-gradient',o['title']['text'],[DATE],['Total Revenue'],o,slots=s)

s,o=simple('03 · Daily revenue and 7-day calendar mean',2)
o['series']=[{'type':'line','name':name,'data':f'$slot.m{i}.values','showSymbol':False,'lineStyle':{'width':1 if i==0 else 3}} for i,name in enumerate(['Daily revenue','7-day rolling mean'])]
save(3,'rolling-line',o['title']['text'],[DATE],['Total Revenue','Stress Rolling Revenue'],o,slots=s,measures={'Stress Rolling Revenue':"DIVIDE(CALCULATE([Total Revenue], DATESINPERIOD('Calendar Lookup'[Date], MAX('Calendar Lookup'[Date]), -7, DAY)), 7)"})

s,o=simple('04 · Mean sales-line revenue · approximate 95% interval',3)
o['series']=[{'type':'line','name':'Lower','stack':'ci','data':'$slot.m0.values','lineStyle':{'opacity':0},'symbol':'none','areaStyle':{'opacity':0}}, {'type':'line','name':'95% interval','stack':'ci','data':'$calc.span.values','symbol':'none','lineStyle':{'opacity':0},'areaStyle':{'color':'#60a5fa','opacity':0.25}}, {'type':'line','name':'Mean','data':'$slot.m2.values','symbol':'none','lineStyle':{'color':'#f59e0b'}}]
o['legend']['data']=['95% interval','Mean']
mean="AVERAGEX('Sales Data', 'Sales Data'[Revenue])"
se="DIVIDE(STDEVX.P('Sales Data', 'Sales Data'[Revenue]), SQRT(COUNTROWS('Sales Data')))"
save(4,'confidence-band',o['title']['text'],[DATE],['Stress CI Low','Stress CI High','Stress Mean'],o,slots=s,transforms=[{'calculate':'m1-m0','as':'span'}],measures={'Stress CI Low':f'{mean} - 1.96 * {se}','Stress CI High':f'{mean} + 1.96 * {se}','Stress Mean':mean})

s,o=simple('05 · Daily sales-line revenue · P10–P90 and P25–P75',5)
o['series']=[{'type':'line','name':'P10','stack':'outer','data':'$slot.m0.values','symbol':'none','lineStyle':{'opacity':0},'areaStyle':{'opacity':0}}, {'type':'line','name':'P10–P90','stack':'outer','data':'$calc.outer.values','symbol':'none','lineStyle':{'opacity':0},'areaStyle':{'color':'#60a5fa','opacity':0.2}}, {'type':'line','name':'P25','stack':'inner','data':'$slot.m1.values','symbol':'none','lineStyle':{'opacity':0},'areaStyle':{'opacity':0}}, {'type':'line','name':'P25–P75','stack':'inner','data':'$calc.inner.values','symbol':'none','lineStyle':{'opacity':0},'areaStyle':{'color':'#60a5fa','opacity':0.4}}, {'type':'line','name':'Median','data':'$slot.m2.values','symbol':'none','lineStyle':{'color':'#f59e0b','width':2}}]
o['legend']['data']=['P10–P90','P25–P75','Median']
save(5,'fan-chart',o['title']['text'],[DATE],[f'Stress P{q}' for q in [10,25,50,75,90]],o,slots=s,transforms=[{'calculate':'m4-m0','as':'outer'},{'calculate':'m3-m1','as':'inner'}],measures={f'Stress P{q}':f"PERCENTILEX.INC('Sales Data', 'Sales Data'[Revenue], {q/100})" for q in [10,25,50,75,90]})

slots={'date':{'kind':'time'},'country':{'kind':'dimension'},'revenue':{'kind':'measure'}}
o=frame('06 · Country revenue horizon · three bands to observed peak',slots)
transforms=[{'stat':{'field':'revenue','op':'max'},'as':'peak'},{'calculate':'peak/3','as':'width'}]
for i in range(3):
 transforms.extend([{'calculate':f'min(max(revenue-width*{i},0),width)','as':f'band{i}'},{'facet':{'by':'country','category':'date','value':f'band{i}','columns':1,'maxPanels':8},'as':f'f{i}'}])
o['grid']={'repeat':'$calc.f0.panels','template':{'left':'18%','top':'$item.top','width':'76%','height':'$item.height'}}
o['xAxis']={'repeat':'$calc.f0.panels','template':{'type':'category','gridIndex':'$item.index','data':'$item.categories','axisLabel':{'show':False},'axisTick':{'show':False},'axisLine':{'show':False}}}
o['yAxis']={'repeat':'$calc.f0.panels','template':{'type':'value','gridIndex':'$item.index','min':0,'max':'$calc.width.max','show':False,'name':'$item.name'}}
o['series']={'concat':[{'repeat':f'$calc.f{i}.panels','template':{'type':'line','name':'$item.name','xAxisIndex':'$item.index','yAxisIndex':'$item.index','data':'$item.data','symbol':'none','lineStyle':{'width':0},'areaStyle':{'color':['#a7f3d0','#34d399','#059669'][i],'opacity':1},'z':i+1}} for i in range(3)]}
o['legend']={'show':False}
o['graphic']={'repeat':'$calc.f0.panels','template':{'type':'text','left':'2%','top':'$item.top','style':{'text':'$item.name','fill':'#cbd5e1','fontSize':11}}}
o['graphic']['template']['style']['fontFamily']='Segoe UI'
save(6,'horizon',o['title']['text'],[MONTH,COUNTRY],['Total Revenue'],o,slots=slots,transforms=transforms)

slots={'date':{'kind':'time'},'subcategory':{'kind':'dimension'},'revenue':{'kind':'measure'}}
o=frame('07 · Top nine subcategory revenue sparklines',slots)
o['grid']={'repeat':'$calc.facets.panels','template':{'left':'$item.left','top':'$item.top','width':'$item.width','height':'$item.height'}}
o['xAxis']={'repeat':'$calc.facets.panels','template':{'type':'category','gridIndex':'$item.index','data':'$item.categories','show':False}}
o['yAxis']={'repeat':'$calc.facets.panels','template':{'type':'value','gridIndex':'$item.index','show':False}}
o['series']={'repeat':'$calc.facets.panels','template':{'type':'line','name':'$item.name','xAxisIndex':'$item.index','yAxisIndex':'$item.index','data':'$item.data','symbol':'none','lineStyle':{'width':2},'areaStyle':{'opacity':0.15}}}
o['legend']={'show':False};o['graphic']={'repeat':'$calc.facets.panels','template':{'type':'group','left':'$item.left','top':'$item.top','children':[{'type':'text','x':0,'y':0,'style':{'text':'$item.name','fill':'#e2e8f0','fontSize':12,'backgroundColor':'#0b0b12'}},{'type':'text','x':0,'y':16,'style':{'text':'$item.lastLabel','fill':'#f8fafc','fontSize':16,'backgroundColor':'#0b0b12'}}]}}
for child in o['graphic']['template']['children']:
 child['z']=100;child['style']['fontFamily']='Segoe UI'
save(7,'sparkline-grid',o['title']['text'],[MONTH,SUBCAT],['Stress Top Nine Revenue'],o,slots=slots,transforms=[{'facet':{'by':'subcategory','category':'date','value':'revenue','columns':3,'maxPanels':9},'as':'facets'}],measures={'Stress Top Nine Revenue':"VAR r = RANKX(ALL('Product Subcategories Lookup'[SubcategoryName]), CALCULATE([Total Revenue], ALL('Calendar Lookup')), , DESC, SKIP) RETURN IF(r <= 9, [Total Revenue])"})

s,o=simple('08 · Revenue composition · profit and cost share',2);s['date']['kind']='dimension'
o['yAxis']['axisLabel']['formatterTemplate']='{value:percent}';o['yAxis']['max']=1
o['series']=[{'type':'bar','name':name,'stack':'share','data':f'$slot.m{i}.values','label':{'show':True,'formatterTemplate':'{value:percent}','color':'#ffffff'}} for i,name in enumerate(['Profit share','Cost share'])]
save(8,'100-percent-column',o['title']['text'],[COUNTRY],['Stress Profit Share','Stress Cost Share'],o,slots=s,measures={'Stress Profit Share':'DIVIDE([Total Profit],[Total Revenue])','Stress Cost Share':'DIVIDE([Total Cost],[Total Revenue])'})

s,o=simple('09 · Country economics · diverging stacked balances',3);s['date']['kind']='dimension'
o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']={'type':'category','data':'$slot.date.values','axisLabel':{'color':'#cbd5e1'}}
o['series']=[{'type':'bar','name':name,'stack':'balance','data':f'$slot.m{i}.values','stackStrategy':'samesign','labelLayout':{'hideOverlap':True},'label':{'show':i<2,'position':'inside','formatterTemplate':'{value:thousands}','color':'#ffffff'}} for i,name in enumerate(['Cost (outflow)','Profit','Returns cost (outflow)'])]
save(9,'diverging-stack',o['title']['text'],[COUNTRY],['Stress Negative Cost','Total Profit','Stress Returns Cost'],o,slots=s,measures={'Stress Negative Cost':'-[Total Cost]','Stress Returns Cost':'-[Quantity Returned] * [Average Retail Price]'})

s,o=simple('10 · Customer pyramid · female / male by birth year',2)
o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1'}};o['yAxis']={'type':'category','data':'$slot.date.values','axisLabel':{'color':'#cbd5e1'}}
o['series']=[{'type':'bar','name':name,'stack':'population','data':f'$slot.m{i}.values'} for i,name in enumerate(['Female (left)','Male (right)'])]
save(10,'population-pyramid',o['title']['text'],[('Customer Lookup','Birth Year')],['Stress Female Customers','Stress Male Customers'],o,slots=s,measures={'Stress Female Customers':"-CALCULATE([Total Customers], 'Customer Lookup'[Gender] = \"F\")",'Stress Male Customers':"CALCULATE([Total Customers], 'Customer Lookup'[Gender] = \"M\")"})

s,o=simple('11 · Country revenue stacks · Bikes and Clothing',4);s['date']['kind']='dimension'
names=['Stress Bike Cost','Stress Bike Profit','Stress Clothing Cost','Stress Clothing Profit']
o['series']=[{'type':'bar','name':name.replace('Stress ',''),'stack':'bikes' if i<2 else 'clothing','data':f'$slot.m{i}.values'} for i,name in enumerate(names)]
save(11,'grouped-stacked',o['title']['text'],[COUNTRY],names,o,slots=s,measures={name:f"CALCULATE([Total {'Cost' if i%2==0 else 'Profit'}], 'Product Categories Lookup'[CategoryName] = \"{'Bikes' if i<2 else 'Clothing'}\")" for i,name in enumerate(names)})

s,o=simple('12 · Country revenue lollipops and target markers',2);s['date']['kind']='dimension'
o['series']=[{'type':'bar','name':'Revenue stem','barWidth':3,'data':'$slot.m0.values'},{'type':'scatter','name':'Revenue','symbolSize':13,'data':'$slot.m0.pairs'},{'type':'scatter','name':'Target','symbol':'rect','symbolSize':[25,4],'data':'$slot.m1.pairs','itemStyle':{'color':'#f59e0b'}}]
save(12,'lollipop-target',o['title']['text'],[COUNTRY],['Total Revenue','Revenue Target'],o,slots=s)

(OUT/'cases-a1.json').write_text(json.dumps(CASES,indent=2),encoding='utf-8')
print(f'Authored {len(CASES)} new specifications from source; no shipped template read.')
