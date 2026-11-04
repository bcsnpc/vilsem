import runpy,json
from pathlib import Path
ctx=runpy.run_path('scripts/qa/stress2/author.py')
save=ctx['save'];frame=ctx['frame'];simple=ctx['simple'];CASES=ctx['CASES'];CASES.clear()
COUNTRY=ctx['COUNTRY'];CAT=ctx['CAT'];SUBCAT=ctx['SUBCAT'];OUT=ctx['OUT']
s,o=simple('13 · Country cost and revenue · Cleveland dots',2);s['date']['kind']='dimension'
o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']={'type':'category','data':'$slot.date.categories','axisLabel':{'color':'#cbd5e1'}}
o['series']=[{'type':'scatter','name':name,'symbolSize':15,'data':f'$slot.m{i}.pairsSwapped'} for i,name in enumerate(['Cost','Revenue'])]
save(13,'cleveland-dots',o['title']['text'],[COUNTRY],['Total Cost','Total Revenue'],o,slots=s)
s,o=simple('14 · Country cost-to-revenue range · delta is profit',2);s['date']['kind']='dimension'
o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']={'type':'category','data':'$slot.date.categories','axisLabel':{'color':'#cbd5e1'}}
o['legend']['show']=False;o['series']=[{'type':'bar','name':'Offset','stack':'range','silent':True,'data':'$slot.m0.values','itemStyle':{'opacity':0},'emphasis':{'disabled':True}},{'type':'bar','name':'Profit delta','stack':'range','data':'$calc.delta.values','label':{'show':True,'position':'inside','formatterTemplate':'Δ {value:thousands}','color':'#ffffff'}}]
save(14,'range-delta',o['title']['text'],[COUNTRY],['Total Cost','Total Revenue'],o,slots=s,transforms=[{'calculate':'m1-m0','as':'delta'}])
s,o=simple('15 · Subcategory revenue · wrapped into columns');s['date']['kind']='dimension';o['legend']['show']=False
for key in ['grid','xAxis','yAxis','series']:o.pop(key,None)
o['grid']={'repeat':'$calc.wrapped.panels','template':{'left':'$item.left','top':'$item.top','width':'$item.width','height':'$item.height','containLabel':True}}
o['xAxis']={'repeat':'$calc.wrapped.panels','template':{'type':'value','gridIndex':'$item.index','splitNumber':2,'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}','hideOverlap':True,'rotate':30,'fontSize':10}}}
o['yAxis']={'repeat':'$calc.wrapped.panels','template':{'type':'category','gridIndex':'$item.index','inverse':True,'data':'$item.categories','axisLabel':{'color':'#cbd5e1','width':85,'overflow':'truncate'}}}
o['series']={'repeat':'$calc.wrapped.panels','template':{'type':'bar','name':'Revenue','xAxisIndex':'$item.index','yAxisIndex':'$item.index','data':'$item.data'}}
save(15,'wrapped-bar',o['title']['text'],[SUBCAT],['Total Revenue'],o,slots=s,transforms=[{'chunk':{'category':'date','value':'m0','size':6,'columns':3},'as':'wrapped'}])
s={'group':{'kind':'dimension'},'raw':{'kind':'dimension'},'count':{'kind':'measure'}};o=frame('16 · Distinct sales-line revenue strip per category',s)
o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1'}};o['yAxis']={'type':'category','data':'$slot.group.categories','axisLabel':{'color':'#cbd5e1'}};o['legend']['show']=False
o['series']=[{'type':'scatter','symbol':'rect','symbolSize':[2,20],'data':'$calc.dots.data','itemStyle':{'opacity':0.35}}]
save(16,'revenue-strip',o['title']['text'],[CAT,('Sales Data','Revenue')],['Total Orders'],o,slots=s,transforms=[{'points':{'fields':['raw','group'],'numeric':['raw'],'name':'group'},'as':'dots'}])
for n,slug,kind in [(17,'polar-column','polar'),(18,'nightingale-rose','rose')]:
 s,o=simple(f'{n:02} · Country revenue · '+('radial columns' if n==17 else 'Nightingale rose'));s['date']['kind']='dimension'
 for key in ['grid','xAxis','yAxis']:o.pop(key,None)
 o['tooltip']={'trigger':'item','confine':True};o['legend']['show']=False
 if kind=='polar':
  o['polar']={'center':['50%','55%'],'radius':'65%'};o['angleAxis']={'type':'category','data':'$slot.date.categories','axisLabel':{'color':'#cbd5e1'}};o['radiusAxis']={'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['series']=[{'type':'bar','coordinateSystem':'polar','data':'$slot.m0.values','name':'Revenue'}]
 else:o['series']=[{'type':'pie','roseType':'area','radius':['10%','65%'],'center':['50%','56%'],'data':'$slot.m0.pieData','label':{'color':'#cbd5e1'}}]
 save(n,slug,o['title']['text'],[COUNTRY],['Total Revenue'],o,slots=s)
s={'margin':{'kind':'measure'},'rest':{'kind':'measure'}};o=frame('19 · Global profit margin · semi-circle KPI',s)
for key in ['grid','xAxis','yAxis']:o.pop(key,None)
o['legend']['show']=False;o['tooltip']={'trigger':'item'};o['series']=[{'type':'pie','startAngle':180,'endAngle':0,'radius':['58%','78%'],'center':['50%','70%'],'label':{'show':False},'data':[{'name':'Profit share','value':'$slot.margin.first','itemStyle':{'color':'#2dd4bf'}},{'name':'Cost share','value':'$slot.rest.first','itemStyle':{'color':'#334155'}}]}]
o['graphic']=[{'type':'text','left':'center','top':'55%','style':{'text':'$slot.margin.lastLabel','fill':'#f8fafc','fontSize':42,'fontFamily':'Segoe UI'}},{'type':'text','left':'center','top':'68%','style':{'text':'Profit margin (%)','fill':'#cbd5e1','fontSize':16,'fontFamily':'Segoe UI'}}]
save(19,'semi-donut-kpi',o['title']['text'],[],['Stress Margin Percent','Stress Remaining Percent'],o,slots=s,measures={'Stress Margin Percent':'100 * DIVIDE([Total Profit],[Total Revenue])','Stress Remaining Percent':'100 * DIVIDE([Total Cost],[Total Revenue])'})
s={'category':{'kind':'dimension'},'subcategory':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('20 · Category and subcategory revenue · nested donut',s)
for key in ['grid','xAxis','yAxis']:o.pop(key,None)
o['legend']['show']=False;o['tooltip']={'trigger':'item'};o['series']=[{'type':'pie','radius':['18%','38%'],'center':['50%','56%'],'data':'$calc.tree.children','label':{'position':'inside','color':'#ffffff'}},{'type':'sunburst','radius':['39%','70%'],'center':['50%','56%'],'data':'$calc.tree.children','levels':[{}, {'r0':'39%','r':'41%','label':{'show':False}},{'r0':'42%','r':'70%','label':{'rotate':'radial','color':'#ffffff'}}]}]
o['series'][0]['minShowLabelAngle']=6;o['series'][0]['labelLayout']={'hideOverlap':True}
o['series'][1]['label']={'minAngle':6};o['series'][1]['levels'][2]['label']['minAngle']=6;o['series'][1]['labelLayout']={'hideOverlap':True}
save(20,'nested-donut',o['title']['text'],[CAT,SUBCAT],['Total Revenue'],o,slots=s,transforms=[{'hierarchy':{'levels':['category','subcategory'],'value':'revenue'},'as':'tree'}])
s,o=simple('21 · Subcategory revenue · top five plus Other');s['date']['kind']='dimension'
for key in ['grid','xAxis','yAxis']:o.pop(key,None)
o['legend']['show']=False;o['tooltip']={'trigger':'item'};o['series']=[{'type':'pie','radius':['25%','65%'],'center':['50%','56%'],'data':'$calc.buckets.pieData','label':{'color':'#cbd5e1'}}]
save(21,'pie-top-other',o['title']['text'],[SUBCAT],['Total Revenue'],o,slots=s,transforms=[{'top':{'category':'date','value':'m0','count':5,'other':'Other'},'as':'buckets'}])
s,o=simple('22 · Country revenue · repeated diamond icons');s['date']['kind']='dimension';o['legend']['show']=False;o['series']=[{'type':'pictorialBar','symbol':'diamond','symbolRepeat':True,'symbolSize':[14,14],'symbolMargin':3,'symbolClip':True,'data':'$slot.m0.values','name':'Revenue'}]
save(22,'pictogram-icons',o['title']['text'],[COUNTRY],['Total Revenue'],o,slots=s)
for n,slug,layout in [(23,'waffle-share','grid'),(24,'hemicycle','hemicycle')]:
 s,o=simple(f'{n} · Country revenue share · '+('100-cell waffle' if n==23 else '100-seat hemicycle'));s['date']['kind']='dimension'
 o['legend']={'top':45,'textStyle':{'color':'#cbd5e1'}};o['grid']={'left':70,'right':70,'top':110,'bottom':45};o['xAxis']={'type':'value','show':False,'min':-1.15 if n==24 else -1,'max':1.15 if n==24 else 10};o['yAxis']={'type':'value','show':False,'min':-0.1 if n==24 else -1,'max':1.15 if n==24 else 10};o['tooltip']={'trigger':'item'}
 o['series']={'repeat':'$calc.seats.groups','template':{'type':'scatter','name':'$item.name','symbol':'roundRect' if n==23 else 'circle','symbolSize':24 if n==23 else 17,'data':'$item.data'}}
 save(n,slug,o['title']['text'],[COUNTRY],['Total Revenue'],o,slots=s,transforms=[{'allocate':{'category':'date','value':'m0','total':100,'layout':layout,'columns':10},'as':'seats'}])
(OUT/'cases-a2.json').write_text(json.dumps(CASES,indent=2),encoding='utf-8')
print('Authored A2:',len(CASES))
