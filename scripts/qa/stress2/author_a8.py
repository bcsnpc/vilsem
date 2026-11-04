"""Fresh A8 constructions and explicit capability proposals, never shipped clones."""
import runpy,json
ctx=runpy.run_path('scripts/qa/stress2/author.py')
save,frame,CASES,OUT=[ctx[k] for k in ['save','frame','CASES','OUT']];CASES.clear()
COUNTRY,CAT,DATE,MONTH,SUBCAT=[ctx[k] for k in ['COUNTRY','CAT','DATE','MONTH','SUBCAT']]
s={'date':{'kind':'time'},'revenue':{'kind':'measure'},'change':{'kind':'measure'}};o=frame('85 - Latest monthly revenue - sparkline and change versus prior month',s)
o['legend']['show']=False;o['grid'].update({'top':350,'bottom':75,'left':90,'right':55});o['xAxis']['axisLabel'].update({'formatterTemplate':'{value:date}','rotate':0})
o['series']=[{'type':'line','name':'Monthly revenue','data':'$slot.revenue.values','showSymbol':False,'lineStyle':{'width':2},'areaStyle':{'opacity':0.12}}]
for name,value,center,size,formatter in [('Latest month','$slot.revenue.lastRowValue',['50%','28%'],50,'{value:thousands}'),('Change vs previous month','$slot.change.lastRowValue',['50%','45%'],24,'{value:percent}')]:
 o['series'].append({'type':'gauge','name':name,'center':center,'radius':'20%','min':-1 if 'Change' in name else 0,'max':1 if 'Change' in name else '$slot.revenue.max','pointer':{'show':False},'axisLine':{'show':False,'lineStyle':{'color':[[0.49975,'#f87171'],[0.50025,'#94a3b8'],[1,'#2dd4bf']]}},'axisTick':{'show':False},'axisLabel':{'show':False},'splitLine':{'show':False},'title':{'show':False},'detail':{'show':True,'offsetCenter':[0,0],'fontSize':size,'formatterTemplate':formatter,'formatterEmptyText':'{empty|No prior revenue}' if 'Change' in name else 'No revenue','rich':{'empty':{'color':'#94a3b8','fontSize':16,'fontWeight':'normal'}},'color':'inherit' if 'Change' in name else '#f8fafc'},'data':[{'name':name,'value':value}]})
defs={'Stress Previous Month Revenue':"VAR currentMonth=MAX('Calendar Lookup'[Start of Month]) RETURN CALCULATE([Total Revenue], FILTER(ALL('Calendar Lookup'), 'Calendar Lookup'[Date]>=EDATE(currentMonth,-1) && 'Calendar Lookup'[Date]<currentMonth))",'Stress Month Change':'IF(NOT ISBLANK([Total Revenue]), DIVIDE([Total Revenue]-[Stress Previous Month Revenue], [Stress Previous Month Revenue]), BLANK())'}
save(85,'kpi-sparkline',o['title']['text'],[MONTH],['Total Revenue','Stress Month Change'],o,slots=s,measures=defs)

MODEL=('Product Lookup','ModelName');s={'model':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame('86 - Twelve highest-revenue product models - inline ranked bars',s);o['legend']['show']=False;o['grid'].update({'left':210,'right':130,'top':90,'bottom':50});o['xAxis']={'type':'value','show':False};o['yAxis']={'type':'category','inverse':True,'data':'$calc.ranked.categories','axisLabel':{'color':'#e2e8f0','width':185,'overflow':'truncate'},'axisTick':{'show':False},'axisLine':{'show':False}};o['series']=[{'type':'bar','name':'Revenue','data':'$calc.ranked.pieData','barWidth':17,'label':{'show':True,'position':'right','formatterTemplate':'{value:thousands}','color':'#e2e8f0'}}]
save(86,'ranked-inline-bars',o['title']['text'],[MODEL],['Total Revenue'],o,slots=s,transforms=[{'top':{'category':'model','value':'revenue','count':12,'other':False},'as':'ranked'}])

for n,slug,description in [(87,'marimekko','variable-width rectangles encoding category share and within-category composition'),(88,'mosaic','nested variable-width and variable-height contingency rectangles')]:
 s={'category':{'kind':'dimension'},'subcategory':{'kind':'dimension'},'revenue':{'kind':'measure'}};o=frame(f'{n} - '+description,s)
 o['series']=[{'type':'custom','renderItem':'Requires an imperative rectangle-per-cell coordinate renderer','data':'$calc.cells.data'}]
 save(n,slug,o['title']['text'],[CAT,SUBCAT],['Total Revenue'],o,slots=s,transforms=[{'points':{'fields':['category','subcategory','revenue'],'numeric':['revenue']},'as':'cells'}])

KEY=('Product Lookup','ProductKey');PRICE=('Product Lookup','ProductPrice')
for n,slug,manual in [(89,'histogram-auto',False),(90,'histogram-width',True)]:
 s={'product':{'kind':'dimension'},'price':{'kind':'dimension'},'sold':{'kind':'measure'}};o=frame(f'{n} - Retail price distribution of products with sales - '+('manual bin width' if manual else 'automatic bins'),s)
 o['legend']['show']=False;o['xAxis']['data']='$calc.bins.categories';o['series']=[{'type':'bar','data':'$calc.bins.data','barCategoryGap':0}]
 histogram={'field':'price',**({'widthParam':'binWidth'} if manual else {'bins':'auto'})}
 save(n,slug,o['title']['text'],[KEY,PRICE],['Quantity Sold'],o,slots=s,params=[{'name':'binWidth','type':'number','default':250,'min':1,'max':5000}] if manual else [],transforms=[{'histogram':histogram,'as':'bins'}])

s={'subcategory':{'kind':'dimension'},'product':{'kind':'dimension'},'price':{'kind':'dimension'},'sold':{'kind':'measure'}}
o=frame('91 - Retail prices by product subcategory - quartiles, whiskers, outliers',s);o['legend']['show']=False;o['grid'].update({'bottom':150,'left':75});o['xAxis']['data']='$calc.box.categories';o['xAxis']['axisLabel'].update({'rotate':50,'fontSize':9});o['series']=[{'type':'boxplot','name':'Price distribution','data':'$calc.box.boxes'},{'type':'scatter','name':'Outliers','data':'$calc.box.outliers','symbolSize':5}]
save(91,'box-detail-prices',o['title']['text'],[SUBCAT,KEY,PRICE],['Quantity Sold'],o,slots=s,transforms=[{'boxplot':{'by':'subcategory','field':'price','whisker':1.5},'as':'box'}])

# A bounded density transform is proposed, not an executable renderItem.
# Actual preview/native geometry must establish whether the closed line-area
# construction can express a violin; do not pre-classify success or category c.
o=frame('92 - Retail-price density by subcategory - violin construction',s);o['legend']['show']=False;o['xAxis']={'type':'value','axisLabel':{'show':False}};o['yAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['series']={'repeat':'$calc.density.panels','template':{'type':'line','name':'$item.name','data':'$item.data','showSymbol':False,'areaStyle':{'opacity':0.5},'lineStyle':{'width':1}}}
o['grid'].update({'bottom':170});o['xAxis'].update({'min':-0.5,'max':'$calc.density.groupMax'});o['yAxis'].update({'min':'$calc.density.min','max':'$calc.density.max'})
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{label}'}
o['series']['template']['markPoint']={'symbolSize':1,'itemStyle':{'opacity':0},'silent':True,'label':{'show':True,'opacity':1,'position':'bottom','rotate':45,'fontSize':8,'width':100,'overflow':'truncate','color':'#cbd5e1','formatterTemplate':'{name}'},'data':[{'name':'$item.name','coord':['$item.index','$calc.density.min']}]}
save(92,'violin-density',o['title']['text'],[SUBCAT,KEY,PRICE],['Quantity Sold'],o,slots=s,transforms=[{'density':{'by':'subcategory','field':'price','layout':'violin','samples':64},'as':'density'}])

swarm_slots={'category':{'kind':'dimension'},'product':{'kind':'dimension'},'price':{'kind':'dimension'},'sold':{'kind':'measure'}}
o=frame('93 - Retail-price beeswarm by product category - bounded collision layout',s);o['legend']['show']=False;o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']={'type':'value','axisLabel':{'show':False}};o['series']=[{'type':'scatter','data':'$calc.swarm.data','symbolSize':5,'itemStyle':{'opacity':0.75}}]
o['grid']={'left':170,'top':95,'width':700,'height':420};o['xAxis'].update({'min':'$calc.swarm.min','max':'$calc.swarm.max'});o['xAxis']['axisLabel'].update({'showMinLabel':False,'showMaxLabel':False});o['yAxis'].update({'min':0,'max':'$calc.swarm.height','splitLine':{'show':False}})
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{label}'};o['series'][0]['symbolSize']='$calc.swarm.symbolSize'
o['series'][0]['markPoint']={'symbolSize':1,'itemStyle':{'opacity':0},'silent':True,'label':{'show':True,'opacity':1,'position':'left','fontSize':8,'width':150,'overflow':'truncate','color':'#cbd5e1','formatterTemplate':'{name}'},'data':{'repeat':'$calc.swarm.groups','template':{'name':'$item.name','coord':['$calc.swarm.min','$item.value']}}}
save(93,'beeswarm',o['title']['text'],[CAT,KEY,PRICE],['Quantity Sold'],o,slots=swarm_slots,transforms=[{'jitter':{'by':'category','field':'price','name':'product','method':'collision','width':700,'height':420,'radius':3},'as':'swarm'}])

o=frame('94 - Retail-price strip plot and mean by subcategory',s);o['legend']['show']=False;o['grid'].update({'left':200});o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']={'type':'category','data':'$slot.subcategory.categories','axisLabel':{'color':'#cbd5e1','fontSize':9}}
o['series']={'concat':[[{'type':'scatter','name':'Product price','data':'$calc.strip.data','symbolSize':4,'itemStyle':{'opacity':0.5}}],{'repeat':'$calc.means.data','template':{'type':'scatter','name':'Subcategory mean','data':[{'name':'$item.name','value':['$item.value','$item.name'],'rowIndexes':'$item.rowIndexes'}],'symbol':'diamond','symbolSize':10,'itemStyle':{'color':'#f59e0b'}}}]}
save(94,'strip-mean',o['title']['text'],[SUBCAT,KEY,PRICE],['Quantity Sold'],o,slots=s,transforms=[{'points':{'fields':['price','subcategory'],'numeric':['price'],'name':'product'},'as':'strip'},{'stat':{'field':'price','op':'mean','partitionBy':'subcategory','records':True},'as':'means'}])

s={'product':{'kind':'dimension'},'price':{'kind':'dimension'},'sold':{'kind':'measure'}};o=frame('95 - Empirical cumulative retail-price distribution of sold products',s);o['legend']['show']=False;o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis'].update({'min':0,'max':1,'axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:percent}'}});o['series']=[{'type':'line','step':'end','data':'$calc.cdf.data','showSymbol':False}]
save(95,'ecdf',o['title']['text'],[KEY,PRICE],['Quantity Sold'],o,slots=s,transforms=[{'ecdf':{'field':'price'},'as':'cdf'}])

s={'subcategory':{'kind':'dimension'},'product':{'kind':'dimension'},'price':{'kind':'dimension'},'sold':{'kind':'measure'}};o=frame('96 - Retail-price ridgelines by subcategory - kernel density',s);o['legend']['show']=False;o['xAxis']={'type':'value','axisLabel':{'color':'#cbd5e1','formatterTemplate':'{value:thousands}'}};o['yAxis']={'type':'value','axisLabel':{'show':False}};o['series']={'repeat':'$calc.density.panels','template':{'type':'line','name':'$item.name','data':'$item.data','showSymbol':False,'areaStyle':{'opacity':0.6},'lineStyle':{'width':1}}}
o['grid'].update({'left':190});o['xAxis'].update({'min':'$calc.density.min','max':'$calc.density.max'});o['yAxis'].update({'min':-0.5,'max':'$calc.density.categories.length'})
o['tooltip']={'trigger':'item','confine':True,'formatterTemplate':'{label}'};o['series']['template']['areaStyle']['origin']='$item.index'
o['series']['template']['markPoint']={'symbolSize':1,'itemStyle':{'opacity':0},'silent':True,'label':{'show':True,'opacity':1,'position':'left','fontSize':8,'width':150,'overflow':'truncate','color':'#cbd5e1','formatterTemplate':'{name}'},'data':[{'name':'$item.name','coord':['$calc.density.min','$item.index']}]}
save(96,'ridgeline',o['title']['text'],[SUBCAT,KEY,PRICE],['Quantity Sold'],o,slots=s,transforms=[{'density':{'by':'subcategory','field':'price','layout':'ridgeline','samples':64},'as':'density'}])

for case in CASES:case['maxRows']=10000
(OUT/'cases-a8.json').write_text(json.dumps(CASES,indent=2),encoding='utf-8')
print('Authored fresh A8 cases:',len(CASES))
