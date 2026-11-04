"""Fresh declarative A7 constructions; pending until actual tools and Desktop acceptance."""
import runpy,json
ctx=runpy.run_path('scripts/qa/stress2/author.py')
save,frame,CASES,OUT=[ctx[k] for k in ['save','frame','CASES','OUT']];CASES.clear()
COUNTRY,CAT,DATE,MONTH=[ctx[k] for k in ['COUNTRY','CAT','DATE','MONTH']]

# Real product taxonomy is a revenue-stage proxy, not fabricated sales pipeline data.
s={'category':{'kind':'dimension'},'revenue':{'kind':'measure'}}
o=frame('73 - Product-category revenue stages - conversion to previous category',s)
for key in ['grid','xAxis','yAxis']:o.pop(key,None)
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{name}: {value:thousands}'}
o['series']=[{'type':'funnel','left':'15%','right':'15%','top':100,'bottom':60,'sort':'none','data':'$slot.revenue.pieData','label':{'show':True,'position':'inside','formatterTemplate':'{name}: {value:thousands}','color':'#f8fafc'}}]
# A proposed data-shaping operation is attempted through validate_spec first.
o['series'][0]['data']='$calc.stages.data';o['series'][0]['label']['formatterTemplate']='{label}'
save(73,'funnel-conversion',o['title']['text'],[CAT],['Total Revenue'],o,slots=s,transforms=[{'conversion':{'category':'category','value':'revenue'},'as':'stages'}])

s={'category':{'kind':'dimension'},'prior':{'kind':'measure'},'current':{'kind':'measure'}}
defs={'Stress Funnel 2021':"CALCULATE([Total Revenue], FILTER(ALL('Calendar Lookup'), YEAR('Calendar Lookup'[Date])=2021))",'Stress Funnel 2022':"CALCULATE([Total Revenue], FILTER(ALL('Calendar Lookup'), YEAR('Calendar Lookup'[Date])=2022))"}
o=frame('74 - Mirrored product-category revenue funnel - 2021 / 2022',s)
for key in ['grid','xAxis','yAxis']:o.pop(key,None)
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{seriesName} | {name}: {value:thousands}'}
o['series']=[{'type':'funnel','name':year,'left':left,'width':'38%','top':105,'bottom':60,'sort':'none','funnelAlign':align,'max':'$calc.ceiling.max','data':f'$slot.{slot}.pieData','label':{'show':True,'position':'inside','formatterTemplate':'{name}','color':'#fff'}} for year,left,align,slot in [('2021','7%','right','prior'),('2022','55%','left','current')]]
o['graphic']=[{'type':'text','left':left,'top':77,'style':{'text':year,'fill':'#e2e8f0','fontSize':14}} for left,year in [('22%','2021'),('70%','2022')]]
save(74,'mirrored-funnel',o['title']['text'],[CAT],list(defs),o,slots=s,measures=defs,transforms=[{'calculate':'max(prior,current)','as':'ceiling'}])

s={'country':{'kind':'dimension'},'revenue':{'kind':'measure'},'margin':{'kind':'measure'},'quantity':{'kind':'measure'}}
o=frame('75 - Country portfolio - revenue / margin quadrant matrix',s);o['legend']['show']=False
o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}}
o['yAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:percent}'}}
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{name} | Revenue {value.0:thousands} | Margin {value.1:percent}'}
o['series']=[{'type':'scatter','data':'$calc.xy.data','symbolSize':25,'label':{'show':True,'position':'top','formatterTemplate':'{name}','color':'#cbd5e1'},'markLine':{'symbol':'none','label':{'show':False},'data':[{'xAxis':'$calc.mx.first'},{'yAxis':'$calc.my.first'}]},'markArea':{'silent':True,'itemStyle':{'color':'#2dd4bf15'},'label':{'position':'insideTopRight','color':'#94a3b8'},'data':[[{'name':'High revenue / margin','xAxis':'$calc.mx.first','yAxis':'$calc.my.first'},{'xAxis':'max','yAxis':'max'}],[{'name':'Lower revenue / margin','xAxis':'min','yAxis':'min'},{'xAxis':'$calc.mx.first','yAxis':'$calc.my.first'}]]}}]
o['xAxis']['max']='$calc.right.first';o['xAxis']['axisLabel']['showMaxLabel']=False;o['yAxis']['axisLabel']['showMaxLabel']=False;o['yAxis'].update({'min':'$calc.bottom.first','max':'$calc.top.first'})
o['series'][0]['labelLayout']={'hideOverlap':True,'moveOverlap':'shiftY'};o['series'][0]['label']['fontSize']=10
o['series'][0]['labelLine']={'show':True,'lineStyle':{'color':'#94a3b8','width':1}}
o['series'][0]['markArea'].update({'label':{'color':'#94a3b8','fontSize':10,'position':'insideTopLeft'},'data':[
 [{'name':'Lower revenue / high margin','xAxis':0,'yAxis':'$calc.my.first'},{'xAxis':'$calc.mx.first','yAxis':'$calc.top.first'}],
 [{'name':'High revenue / high margin','xAxis':'$calc.mx.first','yAxis':'$calc.my.first'},{'xAxis':'$calc.right.first','yAxis':'$calc.top.first'}],
 [{'name':'Lower revenue / lower margin','xAxis':0,'yAxis':'$calc.bottom.first','label':{'position':'insideBottomLeft'}},{'xAxis':'$calc.mx.first','yAxis':'$calc.my.first'}],
 [{'name':'High revenue / lower margin','xAxis':'$calc.mx.first','yAxis':'$calc.bottom.first','label':{'position':'insideBottomLeft'}},{'xAxis':'$calc.right.first','yAxis':'$calc.my.first'}]
]})
save(75,'labelled-quadrants',o['title']['text'],[COUNTRY],['Total Revenue','Stress Portfolio Margin','Quantity Sold'],o,slots=s,measures={'Stress Portfolio Margin':'DIVIDE([Total Profit], [Total Revenue])'},transforms=[{'points':{'fields':['revenue','margin','quantity'],'numeric':['revenue','margin','quantity'],'name':'country'},'as':'xy'},{'stat':{'field':'revenue','op':'median'},'as':'mx'},{'stat':{'field':'margin','op':'median'},'as':'my'},{'stat':{'field':'margin','op':'min'},'as':'minMargin'},{'stat':{'field':'margin','op':'max'},'as':'maxMargin'},{'stat':{'field':'revenue','op':'max'},'as':'maxRevenue'},{'calculate':'minMargin-max(0.01,maxMargin-minMargin)*0.4','as':'bottom'},{'calculate':'maxMargin+max(0.01,maxMargin-minMargin)*0.4','as':'top'},{'calculate':'maxRevenue*1.1','as':'right'}])

s={'date':{'kind':'time'},'revenue':{'kind':'measure'},'profit':{'kind':'measure'}}
o=frame('76 - Monthly revenue and profit - independent vertical zoom sliders',s);o['grid'].update({'left':95,'right':110,'bottom':95});o['xAxis']['axisLabel']['formatterTemplate']='{value:date}'
axis=o['yAxis'];o['yAxis']=[dict(axis,name='Revenue'),dict(axis,name='Profit')]
o['series']=[{'type':'bar','name':'Revenue','data':'$slot.revenue.values'},{'type':'line','name':'Profit','yAxisIndex':1,'data':'$slot.profit.values','showSymbol':False}]
o['dataZoom']=[{'type':'slider','orient':'vertical','yAxisIndex':[0],'left':5,'width':15,'filterMode':'none'},{'type':'slider','orient':'vertical','yAxisIndex':[1],'right':5,'width':15,'filterMode':'none'},{'type':'slider','xAxisIndex':[0],'bottom':15,'height':18,'filterMode':'none'}]
save(76,'independent-axis-zoom',o['title']['text'],[MONTH],['Total Revenue','Total Profit'],o,slots=s)

s={'date':{'kind':'time'},'revenue':{'kind':'measure'}}
o=frame('77 - Daily revenue - weekend calendar bands',s);o['xAxis']={'type':'time','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:date}'}}
o['series']=[{'type':'line','data':'$calc.xy.data','showSymbol':False,'markArea':{'silent':True,'label':{'show':False},'itemStyle':{'color':'#f59e0b22'},'data':'$calc.weekends.areas'}}]
save(77,'weekend-bands',o['title']['text'],[DATE],['Total Revenue'],o,slots=s,transforms=[{'date':{'field':'date'},'as':'epoch'},{'points':{'fields':['epoch','revenue'],'numeric':['epoch','revenue']},'as':'xy'},{'dateBands':{'field':'date','weekdays':[0,6]},'as':'weekends'}])

# Explicit min/max of monthly country revenue provide real descriptive ranges,
# not invented confidence intervals.
range_defs={'Stress Monthly Low':"MINX(VALUES('Calendar Lookup'[Start of Month]), [Total Revenue])",'Stress Monthly High':"MAXX(VALUES('Calendar Lookup'[Start of Month]), [Total Revenue])",'Stress Monthly Mean':"AVERAGEX(VALUES('Calendar Lookup'[Start of Month]), [Total Revenue])"}
s={'country':{'kind':'dimension'},'low':{'kind':'measure'},'high':{'kind':'measure'},'mean':{'kind':'measure'}}
for n,slug,horizontal in [(78,'columns-error-bars',False),(81,'forest-range',True),(82,'dot-whisker',True)]:
 current_defs=range_defs;bound_names=list(range_defs)
 o=frame(f'{n} - Country monthly revenue mean and observed min/max range',s);o['legend']['show']=False
 if horizontal:o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']={'type':'category','data':'$slot.country.values','axisLabel':{'color':'#cbd5e1'}}
 o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{seriesName} | {name}: {value:thousands}'}
 o['series']=[{'type':'bar' if n==78 else 'scatter','name':'Mean','data':'$slot.mean.values','symbolSize':11}]
 # Named records allow bounded line-segment repetition with original identities.
 ends=([{'value':['$item.name','$item.value.0'],'rowIndexes':'$item.rowIndexes'},{'value':['$item.name','$item.value.1'],'rowIndexes':'$item.rowIndexes'}] if not horizontal else [{'value':['$item.value.0','$item.name'],'rowIndexes':'$item.rowIndexes'},{'value':['$item.value.1','$item.name'],'rowIndexes':'$item.rowIndexes'}])
 o['series']={'concat':[o['series'],{'repeat':'$calc.ranges.data','template':{'type':'line','name':'$item.name','data':ends,'symbol':'rect','symbolSize':[12,2] if not horizontal else [2,12],'lineStyle':{'width':2,'color':'#f8fafc'},'itemStyle':{'color':'#f8fafc'},'tooltip':{'formatterTemplate':'{seriesName}: {value.0:thousands} / {value.1:thousands}'}}}]}
 if n==81:
  o['title']['text']='81 - Monthly revenue mean with 95% Student-t confidence interval'
  current_defs={'Stress Monthly Mean':range_defs['Stress Monthly Mean'],'Stress CI N':"COUNTROWS(FILTER(VALUES('Calendar Lookup'[Start of Month]), NOT ISBLANK([Total Revenue])))",'Stress CI Half Width':"IF([Stress CI N]>=2, T.INV.2T(0.05, [Stress CI N]-1)*DIVIDE(STDEVX.S(VALUES('Calendar Lookup'[Start of Month]), [Total Revenue]), SQRT([Stress CI N])), BLANK())",'Stress CI Low':'IF([Stress CI N]>=2, [Stress Monthly Mean]-[Stress CI Half Width], BLANK())','Stress CI High':'IF([Stress CI N]>=2, [Stress Monthly Mean]+[Stress CI Half Width], BLANK())'}
  bound_names=['Stress CI Low','Stress CI High','Stress Monthly Mean']
  o['series']['concat'][1]['template']['tooltip']['formatterTemplate']='{seriesName}: {value.0:thousands}'
  o['graphic']={'type':'text','left':75,'bottom':16,'style':{'text':'95% Student-t CI; monthly observations treated as independent.','fill':'#94a3b8','fontSize':11}}
 save(n,slug,o['title']['text'],[COUNTRY],bound_names,o,slots=s,measures=current_defs,transforms=[{'points':{'fields':['low','high'],'numeric':['low','high'],'name':'country'},'as':'ranges'}])

s={'date':{'kind':'time'},'revenue':{'kind':'measure'},'mean':{'kind':'measure'},'sigma':{'kind':'measure'}}
defs={'Stress Global Daily Mean':"AVERAGEX(ALL('Calendar Lookup'[Date]), [Total Revenue])",'Stress Global Daily Sigma':"STDEVX.P(ALL('Calendar Lookup'[Date]), [Total Revenue])"}
o=frame('79 - Daily revenue control chart - visual-scoped mean +/- 3 sigma',s);o['xAxis']['axisLabel']['formatterTemplate']='{value:date}'
o['series']=[{'type':'line','name':'Revenue','data':'$slot.revenue.values','showSymbol':False,'markLine':{'symbol':'none','label':{'position':'insideEndTop','formatterTemplate':'{name}','color':'#f59e0b'},'data':[{'yAxis':'$slot.mean.first','name':'Mean'},{'yAxis':'$calc.upper.first','name':'+3 sigma'},{'yAxis':'$calc.lower.first','name':'-3 sigma'}]}}]
o['yAxis'].update({'min':'$calc.lowDomain.min','max':'$calc.highDomain.max'})
save(79,'control-chart',o['title']['text'],[DATE],['Total Revenue',*defs],o,slots=s,measures=defs,transforms=[{'calculate':'mean+3*sigma','as':'upper'},{'calculate':'mean-3*sigma','as':'lower'},{'calculate':'max(revenue,mean+3*sigma)','as':'bound'},{'stat':{'field':'bound','op':'max'},'as':'globalMax'},{'calculate':'lower-max(1,globalMax-lower)*0.08','as':'lowDomain'},{'calculate':'globalMax+max(1,globalMax-lower)*0.08','as':'highDomain'}])

s={'date':{'kind':'time'},'revenue':{'kind':'measure'}};o=frame('80 - Monthly revenue EWMA - alpha 0.3',s);o['xAxis']['axisLabel']['formatterTemplate']='{value:date}'
o['series']=[{'type':'line','name':'Revenue','data':'$slot.revenue.values','showSymbol':False},{'type':'line','name':'EWMA 0.3','data':'$calc.average.values','showSymbol':False}]
save(80,'ewma',o['title']['text'],[MONTH],['Total Revenue'],o,slots=s,transforms=[{'window':{'field':'revenue','op':'ewma','alpha':0.3,'orderBy':'date'},'as':'average'}])

s={'country':{'kind':'dimension'},'category':{'kind':'dimension'},'revenue':{'kind':'measure'}}
for n,slug,kind,shared in [(83,'bar-shared-axis','bar',True),(84,'line-free-axis','line',False)]:
 dims=[COUNTRY,CAT if shared else MONTH];s={'country':{'kind':'dimension'},'category':{'kind':'dimension' if shared else 'time'},'revenue':{'kind':'measure'}}
 o=frame(f'{n} - Country revenue small multiples - '+('shared scale' if shared else 'free scales'),s);o['legend']['show']=False
 o['grid']=[{'left':f'{4+c*92/3}%','top':f'{21+r*37.5}%','width':f'{92/3-3}%','height':f'{75/2-12}%','containLabel':True} for r in range(2) for c in range(3)]
 o['xAxis']={'repeat':'$calc.facets.panels','template':{'type':'category','gridIndex':'$item.index','data':'$item.categories','axisLabel':{'color':'#cbd5e1','fontSize':9,'hideOverlap':True,'interval':0 if shared else 'auto',**({'formatterTemplate':'{value:date}'} if not shared else {})}}}
 o['yAxis']={'repeat':'$calc.facets.panels','template':{'type':'value','gridIndex':'$item.index','splitNumber':3,'max':'$calc.facets.max' if shared else None,'axisLabel':{'showMaxLabel':False,'color':'#cbd5e1','fontSize':8,'formatterTemplate':'{value:thousands}'},'splitLine':{'lineStyle':{'color':'#263244'}}}}
 o['series']={'repeat':'$calc.facets.panels','template':{'type':kind,'name':'$item.name','xAxisIndex':'$item.index','yAxisIndex':'$item.index','data':'$item.data','showSymbol':False}}
 o['graphic']={'repeat':'$calc.facets.panels','template':{'type':'text','left':'$item.left','top':'$item.top','style':{'text':'$item.name','fill':'#f8fafc','fontSize':11}}}
 save(n,slug,o['title']['text'],dims,['Total Revenue'],o,slots=s,transforms=[{'facet':{'by':'country','category':'category','value':'revenue','columns':3,'maxPanels':6},'as':'facets'}])

CASES.sort(key=lambda c:c['id'])
for case in CASES:case['maxRows']=10000
(OUT/'cases-a7.json').write_text(json.dumps(CASES,indent=2),encoding='utf-8')
print('Authored fresh A7 cases:',len(CASES))
