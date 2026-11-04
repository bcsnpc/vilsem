"""Fresh A5 flow/network/radar authorship. Reads schema, never shipped templates."""
import runpy,json
ctx=runpy.run_path('scripts/qa/stress2/author.py'); save=ctx['save']; frame=ctx['frame']; CASES=ctx['CASES']; CASES.clear(); OUT=ctx['OUT']; CAT=ctx['CAT'];SUBCAT=ctx['SUBCAT'];COUNTRY=ctx['COUNTRY']
PRODUCT=('Product Lookup','ProductName'); MODEL=('Product Lookup','ModelName'); COLOR=('Product Lookup','ProductColor')
def clean(title,slots):
 o=frame(title,slots)
 for k in ['grid','xAxis','yAxis']:o.pop(k,None)
 o['legend']['show']=False;o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{label}: {value:thousands}'}
 return o
for n,slug,dims,title in [(49,'sankey-two-levels',[CAT,SUBCAT],'Category to subcategory revenue - Sankey'),(50,'sankey-three-levels',[COUNTRY,CAT,SUBCAT],'Country / category / subcategory - value-ordered Sankey'),(51,'parallel-sets',[COUNTRY,CAT,SUBCAT,COLOR],'Country / category / subcategory / colour - alluvial')]:
 s={f'd{i}':{'kind':'dimension'} for i in range(len(dims))}|{'revenue':{'kind':'measure'}}; o=clean(f'{n} - {title}',s)
 o['series']=[{'type':'sankey','left':45,'right':155,'top':90,'bottom':50,'data':'$calc.flow.nodes','links':'$calc.flow.links','nodeAlign':'left','layoutIterations':0 if n>49 else 32,'nodeWidth':14,'nodeGap':12,'draggable':False,'label':{'color':'#e2e8f0','fontSize':10,'formatterTemplate':'{label}','width':130,'overflow':'truncate'},'lineStyle':{'color':'source','opacity':0.3},'emphasis':{'focus':'adjacency'},'labelLayout':{'hideOverlap':True}}]
 save(n,slug,o['title']['text'],dims,['Total Revenue'],o,slots=s,transforms=[{'flows':{'levels':list(s)[:-1],'value':'revenue','order':'value' if n>49 else 'input'},'as':'flow'}])
for n,slug,title in [(52,'chord-ribbons','Country to category revenue - chord ribbons'),(53,'chord-arcs','Country to category revenue - arc links'),(54,'arc-diagram','Country to category revenue - fixed line nodes'),(55,'relationship-force','Top ten products to model - relationship graph'),(56,'network-circular','Country to category revenue - circular network'),(58,'bipartite','Country to category revenue - bipartite graph')]:
 dims=[PRODUCT,MODEL] if n==55 else [COUNTRY,CAT]
 s={'source':{'kind':'dimension'},'target':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=clean(f'{n} - {title}',s)
 flow={'levels':['source','target'],'value':'revenue','order':'value'}
 if n==54:flow['layout']='line'
 if n==58:flow['layout']='bipartite'
 series={'type':'chord' if n==52 else 'graph','data':'$calc.flow.nodes','links':'$calc.flow.links','left':90,'right':100,'top':120,'bottom':100,'label':{'show':True,'formatterTemplate':'{label}','color':'#e2e8f0','fontSize':11},'lineStyle':{'color':'source','opacity':0.6,'curveness':0.25},'emphasis':{'focus':'adjacency'}}
 if n==52:series.update({'center':['50%','55%'],'radius':['72%','85%'],'padAngle':7,'labelLayout':{'hideOverlap':True}})
 else:
  series.update({'layout':'none' if n in (54,58) else 'force' if n==55 else 'circular','roam':False,'draggable':False,'categories':[{'name':dims[0][1]},{'name':dims[1][1]}]})
  if n==54:series.update({'top':270,'bottom':210,'preserveAspect':True,'label':{'show':True,'position':'bottom','rotate':40,'formatterTemplate':'{label}','color':'#e2e8f0','fontSize':11},'lineStyle':{'color':'source','opacity':0.7,'curveness':0.6}})
  if n==55:series.update({'force':{'repulsion':100,'edgeLength':60,'gravity':0.25,'initLayout':'circular','layoutAnimation':False},'labelLayout':{'hideOverlap':True}})
  if n==58:series['label']['position']='right';series['preserveAspect']=True
 o['series']=[series]
 name='Stress Top Product Revenue' if n==55 else 'Total Revenue'; measures={name:"IF(RANKX(ALL('Product Lookup'), [Total Revenue], , DESC, DENSE)<=10, [Total Revenue])"} if n==55 else None
 save(n,slug,o['title']['text'],dims,[name],o,slots=s,transforms=[{'flows':flow,'as':'flow'}],measures=measures)
s={'product':{'kind':'dimension'},'model':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('57 - Top ten product / model revenue - adjacency matrix',s);o['legend']['show']=False;o['xAxis']['data']='$slot.product.categories';o['xAxis']['axisLabel']['fontSize']=9;o['yAxis']={'type':'category','data':'$slot.model.categories','axisLabel':{'color':'#cbd5e1','fontSize':10,'width':130,'overflow':'truncate'}};o['grid']['left']=160;o['visualMap']={'min':'$slot.revenue.min','max':'$slot.revenue.max','orient':'horizontal','left':'center','bottom':8,'inRange':{'color':['#172554','#2dd4bf']},'textStyle':{'color':'#cbd5e1'}};o['series']=[{'type':'heatmap','data':'$slot.revenue.matrix','itemStyle':{'borderWidth':1,'borderColor':'#0b0b12'}}]
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'Revenue {value.2:thousands}'}
o['visualMap'].update({'calculable':True,'formatterTemplate':'{value:thousands}'})
name='Stress Top Product Revenue';save(57,'adjacency-matrix',o['title']['text'],[PRODUCT,MODEL],[name],o,slots=s,measures={name:"IF(RANKX(ALL('Product Lookup'), [Total Revenue], , DESC, DENSE)<=10, [Total Revenue])"})
s={'country':{'kind':'dimension'},'actual':{'kind':'measure'},'target':{'kind':'measure'}};o=clean('59 - Country revenue and model revenue target - radar',s);o['legend']={'show':True,'top':45,'textStyle':{'color':'#cbd5e1'}};o['radar']={'center':['50%','57%'],'radius':'59%','indicator':{'repeat':'$slot.country.categories','template':{'name':'$item'}},'axisName':{'color':'#e2e8f0'},'splitArea':{'areaStyle':{'color':['#111827','#172033']}}}
o['tooltip'].pop('formatterTemplate',None)
o['series']=[{'type':'radar','data':{'concat':[{'repeat':'$calc.actualPanel.panels','template':{'name':'Revenue','value':'$item.values','rowIndexes':'$item.rowIndexes'}},{'repeat':'$calc.targetPanel.panels','template':{'name':'Target','value':'$item.values','rowIndexes':'$item.rowIndexes'}}]},'areaStyle':{'opacity':0.1}}]
save(59,'radar-benchmark',o['title']['text'],[COUNTRY],['Total Revenue','Revenue Target'],o,slots=s,transforms=[{'calculate':'0','as':'constant'},{'facet':{'by':'constant','category':'country','value':'actual'},'as':'actualPanel'},{'facet':{'by':'constant','category':'country','value':'target'},'as':'targetPanel'}])
s={'country':{'kind':'dimension'},'category':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=clean('60 - Category revenue radar - one panel per country',s);ind='$calc.facets.indicators'
o['tooltip'].pop('formatterTemplate',None)
o['radar']=[{'center':[f'{18+(i%3)*32}%',f'{36+(i//3)*40}%'],'radius':95,'indicator':ind,'axisName':{'color':'#cbd5e1','fontSize':9},'splitArea':{'show':False}} for i in range(6)]
o['series']={'repeat':'$calc.facets.panels','template':{'type':'radar','name':'$item.name','radarIndex':'$item.index','data':[{'name':'$item.name','value':'$item.values','rowIndexes':'$item.rowIndexes'}],'areaStyle':{'opacity':0.15}}}
o['graphic']={'repeat':'$calc.facets.panels','template':{'type':'text','left':'$item.left','top':'$item.top','style':{'text':'$item.name','fill':'#e2e8f0','fontSize':13}}}
save(60,'radar-small-multiples',o['title']['text'],[COUNTRY,CAT],['Total Revenue'],o,slots=s,transforms=[{'facet':{'by':'country','category':'category','value':'revenue','columns':3,'maxPanels':6},'as':'facets'}])
CASES.sort(key=lambda c:c['id'])
for case in CASES:case['maxRows']=10000
(OUT/'cases-a5.json').write_text(json.dumps(CASES,indent=2),encoding='utf-8');print('Authored fresh A5 cases:',len(CASES))
