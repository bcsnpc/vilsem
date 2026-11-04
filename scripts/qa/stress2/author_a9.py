"""Fresh statistical/derived constructions; unsupported operations are proposals.

Never clones shipped specs. Every binding is checked against captured get_schema.
"""
import runpy,json
c=runpy.run_path('scripts/qa/stress2/author.py');save,frame,CASES,OUT=[c[k] for k in ['save','frame','CASES','OUT']];CASES.clear()
MONTH,DATE,COUNTRY,CAT,SUBCAT=[c[k] for k in ['MONTH','DATE','COUNTRY','CAT','SUBCAT']]
KEY=('Product Lookup','ProductKey');PRICE=('Product Lookup','ProductPrice');COST=('Product Lookup','ProductCost')
s={'product':{'kind':'dimension'},'price':{'kind':'dimension'},'sold':{'kind':'measure'}}
o=frame('97 - Product retail prices versus normal theoretical quantiles',s);o['legend']['show']=False;o['xAxis']={'type':'value','name':'Normal quantile','axisLabel':{'color':'#cbd5e1'}};o['series']=[{'type':'scatter','data':'$calc.qq.data','symbolSize':5}]
save(97,'normal-qq',o['title']['text'],[KEY,PRICE],['Quantity Sold'],o,slots=s,transforms=[{'qq':{'field':'price'},'as':'qq'}])
s={'product':{'kind':'dimension'},'price':{'kind':'dimension'},'cost':{'kind':'dimension'},'sold':{'kind':'measure'}}
for n,slug,op in [(98,'hexbin-price-cost','hexbin'),(99,'density2d-price-cost','density2d')]:
 o=frame(f'{n} - Sold product retail price versus cost - '+('hexagonal counts' if n==98 else 'bounded 2-D density grid'),s);o['legend']['show']=False;o['grid'].update({'bottom':120});o['xAxis']={'type':'value','name':'Retail price','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']['name']='Cost'
 o['series']=[{'type':'scatter','data':'$calc.binned.data','symbol':'path://M0,-10L8.66,-5L8.66,5L0,10L-8.66,5L-8.66,-5Z' if n==98 else 'rect','symbolSize':16 if n==98 else 12}]
 o['visualMap']={'type':'continuous','dimension':2,'min':0,'max':'$calc.binned.max','orient':'horizontal','bottom':15,'left':'center','textStyle':{'color':'#cbd5e1'},'inRange':{'color':['#172554','#14b8a6','#fef08a']}}
 save(n,slug,o['title']['text'],[KEY,PRICE,COST],['Quantity Sold'],o,slots=s,transforms=[{op:{'x':'price','y':'cost','bins':24},'as':'binned'}])
s={'subcategory':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('100 - Top N subcategory revenue with Other - N parameter',s);o['legend']['show']=False;o.pop('xAxis');o.pop('yAxis');o['series']=[{'type':'pie','radius':['35%','65%'],'center':['50%','52%'],'data':'$calc.ranked.pieData','label':{'show':True,'color':'#cbd5e1','formatterTemplate':'{name}'},'labelLayout':{'hideOverlap':True}}]
save(100,'parameter-top-other',o['title']['text'],[SUBCAT],['Total Revenue'],o,slots=s,params=[{'name':'topN','type':'number','default':5,'min':1,'max':15}],transforms=[{'top':{'category':'subcategory','value':'revenue','countParam':'topN'},'as':'ranked'}])
s={'country':{'kind':'dimension'},'category':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('101 - Category share within country - country revenue subtotals',s);o['legend']['show']=False;o['grid'].update({'left':180,'bottom':60});o['xAxis']={'type':'value','min':0,'max':1,'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:percent}'}};o['yAxis']={'type':'category','data':'$calc.shares.categories','axisLabel':{'color':'#cbd5e1','fontSize':9}};o['series']=[{'type':'bar','data':'$calc.shares.data','label':{'show':True,'position':'insideRight','formatterTemplate':'{value:percent}','color':'#fff'}}]
save(101,'group-percent-subtotals',o['title']['text'],[COUNTRY,CAT],['Total Revenue'],o,slots=s,transforms=[{'groupShare':{'by':'country','category':'category','value':'revenue','subtotals':True},'as':'shares'}])
s={'country':{'kind':'dimension'},'current':{'kind':'measure'},'prior':{'kind':'measure'},'variance':{'kind':'measure'}};o=frame('102 - Country revenue 2022 versus 2021 - year-over-year variance',s);o['xAxis']['data']='$slot.country.values';o['series']=[{'type':'bar','name':'2021','data':'$slot.prior.values'},{'type':'bar','name':'2022','data':'$calc.current.data','label':{'show':True,'position':'top','formatterTemplate':'{label}','color':'#cbd5e1'}}]
defs={'Stress Revenue 2022':"CALCULATE([Total Revenue], 'Calendar Lookup'[Year]=2022)",'Stress Revenue 2021':"CALCULATE([Total Revenue], 'Calendar Lookup'[Year]=2021)",'Stress YoY Variance':'DIVIDE([Stress Revenue 2022]-[Stress Revenue 2021], [Stress Revenue 2021])'}
save(102,'yoy-variance',o['title']['text'],[COUNTRY],list(defs),o,slots=s,measures=defs,transforms=[{'conditional':{'value':'current','condition':'variance','label':'variance','positive':'#2dd4bf','negative':'#f87171','zero':'#94a3b8','labelFormat':'percent'},'as':'current'}])
s={'month':{'kind':'time'},'country':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('103 - Country monthly revenue rebased to first nonzero month = 100',s);o['xAxis']['data']='$calc.panels.panels.0.categories';o['series']={'repeat':'$calc.panels.panels','template':{'type':'line','name':'$item.name','data':'$item.data','showSymbol':False}};o['yAxis']['name']='Index'
save(103,'rebase-index',o['title']['text'],[MONTH,COUNTRY],['Total Revenue'],o,slots=s,transforms=[{'rebase':{'field':'revenue','partitionBy':'country','orderBy':'month','base':100},'as':'indexed'},{'facet':{'by':'country','category':'month','value':'indexed','maxPanels':6},'as':'panels'}])
s={'date':{'kind':'time'},'current':{'kind':'measure'},'prior':{'kind':'measure'}};o=frame('104 - Year-to-date revenue versus same-period prior year',s);o['xAxis']['axisLabel']['formatterTemplate']='{value:date}';o['series']=[{'type':'line','name':name,'data':f'$slot.{slot}.values','showSymbol':False} for name,slot in [('YTD','current'),('Prior-year YTD','prior')]]
save(104,'ytd-prior-year',o['title']['text'],[MONTH],['YTD Revenue','Stress Prior YTD'],o,slots=s,measures={'Stress Prior YTD':"CALCULATE([YTD Revenue], SAMEPERIODLASTYEAR('Calendar Lookup'[Date]))"})
CUSTOMER=('Customer Lookup','CustomerKey');s={'month':{'kind':'time'},'customer':{'kind':'dimension'},'activity':{'kind':'measure'},'firstPurchase':{'kind':'measure'}};o=frame('105 - Customer first-purchase cohort retention by month offset',s);o['legend']['show']=False;o['grid'].update({'left':130,'bottom':120});o['xAxis']['data']='$calc.retention.periods';o['xAxis']['name']='Months since first purchase';o['yAxis']={'type':'category','data':'$calc.retention.cohorts','axisLabel':{'color':'#cbd5e1'}};o['series']=[{'type':'heatmap','data':'$calc.retention.data'}];o['visualMap']={'min':0,'max':1,'bottom':10,'orient':'horizontal','left':'center','textStyle':{'color':'#cbd5e1'},'inRange':{'color':['#172554','#14b8a6','#fef08a']}}
save(105,'cohort-retention',o['title']['text'],[MONTH,CUSTOMER],['Total Orders','Stress First Purchase Day'],o,slots=s,measures={'Stress First Purchase Day':"VAR firstDate=CALCULATE(MIN('Sales Data'[OrderDate]), REMOVEFILTERS('Calendar Lookup')) RETURN IF(NOT ISBLANK(firstDate), DATEDIFF(DATE(1970,1,1), firstDate, DAY))"},transforms=[{'cohort':{'date':'month','entity':'customer','value':'activity','firstDay':'firstPurchase','maxPeriods':36},'as':'retention'}])
s={'country':{'kind':'dimension'},'category':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('106 - Long-format country/category revenue pivot',s);o['legend']['show']=False;o['grid'].update({'left':150,'bottom':120});o['xAxis']['data']='$calc.pivot.columns';o['yAxis']={'type':'category','data':'$calc.pivot.rows','axisLabel':{'color':'#cbd5e1'}};o['series']=[{'type':'heatmap','data':'$calc.pivot.data','label':{'show':True,'formatterTemplate':'{value.2:thousands}','color':'#fff'}}];o['visualMap']={'min':0,'max':'$calc.pivot.max','bottom':10,'orient':'horizontal','left':'center','textStyle':{'color':'#cbd5e1'},'inRange':{'color':['#172554','#14b8a6']}}
save(106,'pivot-heatmap',o['title']['text'],[COUNTRY,CAT],['Total Revenue'],o,slots=s,transforms=[{'pivot':{'row':'country','column':'category','value':'revenue'},'as':'pivot'}])
names=['Total Revenue','Total Profit','Total Cost','Total Orders','Quantity Sold','Total Customers'];s={'month':{'kind':'time'}}|{f'm{i}':{'kind':'measure'} for i in range(6)};o=frame('107 - Pearson correlation of six monthly measures - pairwise complete',s);o['legend']['show']=False;o['grid'].update({'left':140,'bottom':160});o['xAxis']['data']='$calc.correlation.categories';o['xAxis']['axisLabel']['rotate']=40;o['yAxis']={'type':'category','data':'$calc.correlation.categories','axisLabel':{'color':'#cbd5e1'}};o['series']=[{'type':'heatmap','data':'$calc.correlation.data','label':{'show':True,'formatterTemplate':'{value.2}','color':'#fff'}}];o['visualMap']={'min':-1,'max':1,'bottom':10,'orient':'horizontal','left':'center','textStyle':{'color':'#cbd5e1'},'inRange':{'color':['#991b1b','#334155','#0d9488']}}
save(107,'pearson-six',o['title']['text'],[MONTH],names,o,slots=s,transforms=[{'correlation':{'fields':[f'm{i}' for i in range(6)],'names':names},'as':'correlation'}])
s={'subcategory':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('108 - Revenue Pareto - count of subcategories reaching 80 percent',s);o['xAxis']['data']='$calc.pareto.categories';o['yAxis']=[o['yAxis'],{'type':'value','min':0,'max':1,'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:percent}'}}];o['series']=[{'type':'bar','name':'Revenue','data':'$calc.pareto.data'},{'type':'line','name':'Cumulative share','yAxisIndex':1,'data':'$calc.pareto.cumulative','markLine':{'symbol':'none','data':[{'yAxis':.8}]}},{'type':'gauge','center':['72%','20%'],'radius':'10%','min':0,'max':100,'pointer':{'show':False},'axisLine':{'show':False},'axisTick':{'show':False},'axisLabel':{'show':False},'splitLine':{'show':False},'title':{'show':False},'detail':{'fontSize':15,'color':'#e2e8f0','formatterTemplate':'{value} categories reach 80%'},'data':[{'value':'$calc.pareto.thresholdCount'}]}]
save(108,'pareto-count',o['title']['text'],[SUBCAT],['Total Revenue'],o,slots=s,transforms=[{'pareto':{'category':'subcategory','value':'revenue','threshold':.8},'as':'pareto'}])
for case in CASES:case['maxRows']=10000
case=next(c for c in CASES if c['id']==101);file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
spec['template']['template']['xAxis'].update({'max':1.15,'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:percent}','showMaxLabel':False}})
spec['template']['template']['series'][0]['label'].update({'position':'right','fontSize':10,'color':'#cbd5e1'})
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
# Centre numeric-axis names; end placement clips at the card's right edge.
for case in [c for c in CASES if c['id'] in (97,98,105)]:
 file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
 spec['template']['template']['xAxis'].update({'nameLocation':'middle','nameGap':45})
 file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
# A true tiled 2-D density heatmap, preserving the raw XY data contract too.
case=next(c for c in CASES if c['id']==99);file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
o=spec['template']['template'];o['xAxis']={'type':'category','data':'$calc.binned.columns','name':'Retail price','nameLocation':'middle','nameGap':45,'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}','hideOverlap':True,'rotate':35}}
o['yAxis']={'type':'category','data':'$calc.binned.rows','name':'Cost','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}','hideOverlap':True}}
o['series']=[{'type':'heatmap','data':'$calc.binned.cells'}];o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{label}'}
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
# The transform output must not shadow the measure slot named current.
case=next(c for c in CASES if c['id']==102)
file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
spec['template']['transforms'][0]['as']='coloured'
spec['template']['template']['series'][1]['data']='$calc.coloured.data'
spec['template']['template']['series'][0]['itemStyle']={'color':'#60a5fa'}
spec['template']['template']['series'][1]['itemStyle']={'color':'#94a3b8'}
spec['template']['template']['title']['subtext']='2021 blue; 2022 green=growth, red=decline; labels show year-over-year change'
spec['template']['template']['title']['subtextStyle']={'fontSize':10,'color':'#94a3b8'}
spec['template']['template']['legend']['top']=55
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
case=next(c for c in CASES if c['id']==103);file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
spec['template']['template']['xAxis']['axisLabel']['formatterTemplate']='{value:date}'
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
# Be explicit about the finite query window behind retention membership.
case=next(c for c in CASES if c['id']==107);file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
spec['template']['template']['series'][0]['label']['formatterTemplate']='{value.2:thousands}'
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
case=next(c for c in CASES if c['id']==105);file=OUT/'pending'/case['file'];spec=json.loads(file.read_text(encoding='utf-8'))
spec['template']['template']['title']['subtext']='50 real customers (keys11000-11049); first purchase uses full model history'
spec['template']['template']['title']['subtextStyle']={'color':'#94a3b8','fontSize':10}
spec['measures']['Stress First Purchase Day']=spec['measures']['Stress First Purchase Day'].replace('IF(NOT ISBLANK(firstDate),','IF(NOT ISBLANK([Total Orders]) && NOT ISBLANK(firstDate),')
spec['measures']['Stress First Purchase Day']=spec['measures']['Stress First Purchase Day'].replace('firstDate','acquisitionDate')
spec['measures']['Stress First Purchase Day']=spec['measures']['Stress First Purchase Day'].replace('[Total Orders]','[Stress Cohort Orders]')
spec['measures']['Stress Cohort Orders']="VAR cohortCustomer=MAX('Customer Lookup'[CustomerKey]) RETURN IF(cohortCustomer>=11000 && cohortCustomer<11050, [Total Orders], BLANK())"
case['bindings']['measures'][0]['name']='Stress Cohort Orders'
file.write_text(json.dumps(spec,indent=2),encoding='utf-8')
(OUT/'cases-a9.json').write_text(json.dumps(CASES,indent=2),encoding='utf-8')
print('Fresh A9 cases:',len(CASES))
