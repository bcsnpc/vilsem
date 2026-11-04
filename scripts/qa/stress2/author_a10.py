"""Fresh final-batch definitions, including intentional out-of-capability probes."""
import runpy,json
c=runpy.run_path('scripts/qa/stress2/author.py');save,frame,CASES,OUT=[c[k] for k in ['save','frame','CASES','OUT']];CASES.clear()
DATE,COUNTRY,CAT,SUBCAT=[c[k] for k in ['DATE','COUNTRY','CAT','SUBCAT']]
s={'date':{'kind':'time'},'revenue':{'kind':'measure'}};o=frame('109 - Daily sales observations - spike histogram',s);o['legend']['show']=False;o['xAxis']['axisLabel']['formatterTemplate']='{value:date}';o['series']=[{'type':'bar','data':'$slot.revenue.values','barMaxWidth':2}]
save(109,'date-spikes',o['title']['text'],[DATE],['Total Revenue'],o,slots=s)
s={'product':{'kind':'dimension'},'price':{'kind':'dimension'},'sold':{'kind':'measure'}};o=frame('110 - Sold-product retail-price frequency - polar bins',s);o.pop('xAxis');o.pop('yAxis');o['legend']['show']=False;o['polar']={'radius':['10%','70%'],'center':['50%','54%']};o['angleAxis']={'type':'category','data':'$calc.hist.categories','axisLabel':{'color':'#cbd5e1','fontSize':9}};o['radiusAxis']={'type':'value','axisLabel':{'color':'#cbd5e1'},'splitLine':{'lineStyle':{'color':'#334155'}}};o['series']=[{'type':'bar','coordinateSystem':'polar','data':'$calc.hist.data','barCategoryGap':0}]
save(110,'radial-histogram',o['title']['text'],[('Product Lookup','ProductKey'),('Product Lookup','ProductPrice')],['Quantity Sold'],o,slots=s,transforms=[{'histogram':{'field':'price','bins':12},'as':'hist'}])
for n,slug,kind in [(111,'choropleth','map'),(112,'bubble-map','scatter'),(113,'geo-heatmap','heatmap'),(114,'flow-map','lines')]:
 s={'country':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame(f'{n} - {slug} - geographic capability probe',s);o.pop('xAxis');o.pop('yAxis');o['geo']={'map':'world','roam':True};o['series']=[{'type':kind,'coordinateSystem':'geo','data':'$slot.revenue.pieData'}]
 # get_schema has country, but no latitude/longitude or origin/destination
 # coordinate fields. Do not invent coordinates/geocode client data. The
 # renderer must refuse the absent map capability before executing a query.
 save(n,slug,o['title']['text'],[COUNTRY],['Total Revenue'],o,slots=s)
s={'country':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('115 - Fixed country tile grid - revenue',s);o['legend']['show']=False;o['grid'].update({'left':100,'right':100,'bottom':120});o['xAxis']={'type':'category','data':[0,1,2,3,4],'show':False};o['yAxis']={'type':'category','data':[0,1,2],'show':False};o['series']=[{'type':'heatmap','data':'$calc.tiles.data','label':{'show':True,'color':'#fff','formatterTemplate':'{name}'},'itemStyle':{'borderColor':'#0b0b12','borderWidth':5}}];o['visualMap']={'min':0,'max':'$calc.tiles.max','left':'center','bottom':15,'orient':'horizontal','inRange':{'color':['#172554','#0d9488']},'textStyle':{'color':'#cbd5e1'}}
save(115,'country-tile-grid',o['title']['text'],[COUNTRY],['Total Revenue'],o,slots=s,transforms=[{'tiles':{'category':'country','value':'revenue','positions':[{'name':'Canada','x':0,'y':2},{'name':'United States','x':0,'y':1},{'name':'United Kingdom','x':2,'y':2},{'name':'France','x':2,'y':1},{'name':'Germany','x':3,'y':1},{'name':'Australia','x':4,'y':0}]},'as':'tiles'}])
s={'word':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('116 - Product-name word cloud weighted by revenue',s);o.pop('xAxis');o.pop('yAxis');o['series']=[{'type':'wordCloud','data':'$slot.revenue.pieData'}]
save(116,'word-cloud',o['title']['text'],[('Product Lookup','ProductName')],['Total Revenue'],o,slots=s)
s={'category':{'kind':'dimension'},'subcategory':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('117 - Voronoi treemap of product-category revenue',s);o['series']=[{'type':'custom','renderItem':'Requires a bounded polygon tessellation renderer for Voronoi cells','data':'$calc.tree.children'}]
save(117,'voronoi-treemap',o['title']['text'],[CAT,SUBCAT],['Total Revenue'],o,slots=s,transforms=[{'hierarchy':{'levels':['category','subcategory'],'value':'revenue'},'as':'tree'}])
s={'category':{'kind':'dimension'},'subcategory':{'kind':'dimension'},'product':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('118 - Revenue hierarchy flame chart - taxonomy widths, not CPU time',s);o['legend']['show']=False;o['grid'].update({'left':130});o['xAxis']={'type':'value','min':0,'max':1,'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:percent}'}};o['yAxis']={'type':'category','inverse':True,'data':['Category','Subcategory','Product'],'axisLabel':{'color':'#cbd5e1'}}
o['series']={'concat':[{'repeat':'$calc.flame.nodes','template':{'type':'bar','stack':'$item.id','silent':True,'data':'$item.base','itemStyle':{'opacity':0},'barGap':'-100%'}},{'repeat':'$calc.flame.nodes','template':{'type':'bar','name':'$item.name','stack':'$item.id','data':'$item.data','barGap':'-100%','barCategoryGap':'8%','label':{'show':True,'position':'inside','formatterTemplate':'{seriesName}','fontSize':8,'overflow':'truncate'},'emphasis':{'focus':'self'}}}]}
save(118,'hierarchy-flame',o['title']['text'],[CAT,SUBCAT,('Product Lookup','ProductName')],['Total Revenue'],o,slots=s,transforms=[{'hierarchy':{'levels':['category','subcategory','product'],'value':'revenue','layout':'partition'},'as':'flame'}])
s={'country':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('119 - Three-dimensional country revenue bars',s);o['series']=[{'type':'bar3D','data':'$slot.revenue.pairs'}]
save(119,'bar3d',o['title']['text'],[COUNTRY],['Total Revenue'],o,slots=s)
s={'category':{'kind':'dimension'},'customers':{'kind':'measure'}};o=frame('120 - Customer set overlaps by product category - Euler diagram',s);o['series']=[{'type':'custom','renderItem':'Requires set-intersection query shaping and a constrained circle-area overlap renderer','data':'$slot.customers.pieData'}]
save(120,'euler-overlap',o['title']['text'],[CAT],['Total Customers'],o,slots=s)
for case in CASES:case['maxRows']=10000
# Revisit the initial missing plugin: trusted rectangle packing can instead
# supply ordinary graph labels with identities, without an imperative series.
case=next(c for c in CASES if c['id']==118);file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
spec['template']['transforms'][0]['hierarchy']['size']=700
spec['template']['template']['grid'].update({'width':700,'containLabel':False})
marks=spec['template']['template']['series']['concat'][1]['template']
marks['label'].update({'show':'$item.labelVisible','width':'$item.labelWidth','overflow':'truncate'})
marks['labelLayout']={'hideOverlap':True}
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
case=next(c for c in CASES if c['id']==116);file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
t=spec['template'];t['transforms']=[{'words':{'text':'word','weight':'revenue','limit':24,'width':750,'height':400,'minFont':12,'maxFont':36},'as':'words'}]
o=t['template'];o['title']['text']='116 - Product-name terms weighted by product revenue - top24 words'
o['title']['subtext']='Revenue-weighted word occurrences; fixed750x400 layout, conservative no-overlap bounds'
o['title']['subtextStyle']={'color':'#94a3b8','fontSize':10};o['legend']['show']=False
o['grid']={'left':75,'top':100,'width':750,'height':400,'containLabel':False}
o['xAxis']={'type':'value','min':0,'max':750,'show':False};o['yAxis']={'type':'value','min':0,'max':400,'inverse':True,'show':False}
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{name}: {value.2:thousands}'}
o['series']=[{'type':'graph','coordinateSystem':'cartesian2d','layout':'none','data':'$calc.words.data','links':[],'label':{'show':True,'position':'inside'},'emphasis':{'focus':'self'}}]
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
(OUT/'cases-a10.json').write_text(json.dumps(CASES,indent=2),encoding='utf-8')
print('Fresh final batch:',len(CASES))
