import {describe,it,expect,vi} from 'vitest'
import {validateExpression,createExpressionRenderer,compileExpressionSeries,resolveExpressionTokens,EXPRESSION_LIMITS} from '../packages/core/src/expressions/index.js'
const op=(op,...args)=>({op,args})
const ast=root=>({language:'vilsem-expression',version:1,root})
const rect=x=>ast({type:'rect',shape:{x,y:0,width:10,height:20},style:{fill:'#123456'}})
const label=x=>ast({type:'text',style:{text:x}})
const api={value:i=>[12,.2345,'Bikes'][i],coord:p=>p.map(n=>n*10),size:p=>p.map(n=>n*5),visual:()=> '#123456',style:()=>({fill:'#123456',opacity:1})}
const draw=(a,options={},customApi=api)=>createExpressionRenderer(a,options)({dataIndex:3},customApi)
describe('bounded expression operations',()=>{
 it('keeps explicitly silent annotation decoration stable while data marks dim',()=>{
  const a=rect(0);a.root.role='annotation';a.root.silent=true;a.root.style.opacity=.6
  const selectedApi={...api,style:()=>({fill:'#abcdef',opacity:.25})}
  expect(draw(a,{},selectedApi).style.opacity).toBe(.6)
  a.root.silent=false;expect(draw(a,{},selectedApi).style.opacity).toBe(.15)
  a.root.silent=true;a.root.role='mark';expect(draw(a,{},selectedApi).style.opacity).toBe(.15)
 })
 it('reads only trusted viewport dimensions and recomputes them after resize',()=>{
  let width=900,height=550
  const a=ast({type:'rect',shape:{x:12,y:12,width:op('max',0,op('sub',op('viewportWidth'),24)),height:op('max',0,op('sub',op('viewportHeight'),24)),r:12},style:{fill:'#ffffff'}})
  expect(validateExpression(a).valid).toBe(true)
  const render=createExpressionRenderer(a),viewport={...api,getWidth:()=>width,getHeight:()=>height}
  expect(render({dataIndex:0},viewport).shape).toMatchObject({width:876,height:526})
  width=240;height=120
  expect(render({dataIndex:0},viewport).shape).toMatchObject({width:216,height:96})
  width=0;height=0
  expect(render({dataIndex:0},viewport).shape).toMatchObject({width:0,height:0})
  expect(()=>render({dataIndex:0},api)).toThrow(/viewport dimensions are unavailable/)
  for(const bad of [-1,Infinity,NaN,1000001])expect(()=>render({dataIndex:0},{...viewport,getWidth:()=>bad})).toThrow()
  expect(validateExpression(rect(op('viewportWidth',1))).errors[0].path).toContain('/args')
 })
 const numeric=[['add',[2,3],5],['sub',[8,3],5],['mul',[2,3,4],24],['div',[9,3],3],['mod',[9,4],1],['pow',[2,3],8],['neg',[3],-3],['abs',[-3],3],['sqrt',[16],4],['floor',[2.7],2],['ceil',[2.1],3],['round',[2.6],3],['min',[2,1,3],1],['max',[2,1,3],3],['clamp',[10,0,5],5],['sin',[0],0],['cos',[0],1]]
 it.each(numeric)('%s evaluates finite arithmetic', (name,args,expected)=>{const a=rect(op(name,...args));expect(validateExpression(a).valid).toBe(true);expect(draw(a).shape.x).toBe(expected)})
 it.each([['eq',1,1,true],['ne',1,2,true],['lt',1,2,true],['lte',2,2,true],['gt',2,1,true],['gte',2,2,true]])('%s compares values',(name,a,b,expected)=>expect(draw(rect(op('if',op(name,a,b),4,8))).shape.x).toBe(expected?4:8))
 it('short-circuits conditions/booleans and explicitly handles null',()=>{
  expect(draw(rect(op('if',op('and',true,op('not',false)),2,op('div',1,0)))).shape.x).toBe(2)
  expect(draw(rect(op('if',op('or',true,op('eq',op('div',1,0),1)),4,5))).shape.x).toBe(4)
  expect(draw(rect(op('coalesce',null,op('number',''),op('number','42')))).shape.x).toBe(42)
 })
 it('exposes only the listed data/coordinate/style routes',()=>{
  expect(draw(rect(op('dataIndex'))).shape.x).toBe(3)
  expect(draw(rect(op('value',0))).shape.x).toBe(12)
  expect(draw(rect(op('at',op('coord',[2,3]),0))).shape.x).toBe(20)
  expect(draw(rect(op('at',op('size',[2,3],[0,0]),1))).shape.x).toBe(15)
  expect(draw(ast({type:'circle',shape:{cx:0,cy:0,r:5},style:op('style')})).style.fill).toBe('#123456')
  expect(draw(label(op('visual','color'))).style.text).toBe('#123456')
 })
 it('formats strings, numbers and UTC dates without compiling source',()=>{
  expect(draw(label(op('concat','Margin ',op('formatNumber',.2345,'0.00%')))).style.text).toBe('Margin 23.45%')
  expect(draw(label(op('format',1234,'#,0'))).style.text).toBe('1,234')
  expect(draw(label(op('formatDate','2025-01-12','yyyy-MM-dd'))).style.text).toBe('2025-01-12')
  expect(draw(label(op('string',42))).style.text).toBe('42')
  expect(draw(rect(op('length',[1,2,3]))).shape.x).toBe(3)
 })
 it('keeps explicit dollar literals inert while resolving declared parameters',()=>{
  const a=label(op('concat',op('literal','$not-a-token '),op('formatNumber',12,op('literal','$#,0.00'))))
  expect(draw(resolveExpressionTokens(a,()=>{throw Error('Literal must not resolve')})).style.text).toBe('$not-a-token $12.00')
  expect(draw(resolveExpressionTokens(rect('$param.width'),token=>token==='$param.width'?42:undefined)).shape.x).toBe(42)
 })
 it('interpolates/scales bounded colours',()=>{
  expect(draw(ast({type:'circle',shape:{cx:0,cy:0,r:5},style:{fill:op('colorInterpolate','#000000','#ffffff',.5)}})).style.fill).toBe('rgba(128,128,128,1)')
  expect(draw(label(op('colorScale',5,0,10,['#000000','#ffffff']))).style.text).toBe('rgba(128,128,128,1)')
 })
 it('preserves incoming selection opacity even when authored opacity is1',()=>{
  const a=rect(0);a.root.style.opacity=1
  expect(draw(a,{}, {...api,style:()=>({opacity:.25})}).style.opacity).toBe(.25)
  a.root.style=op('style');expect(draw(a,{}, {...api,style:()=>({opacity:.25})}).style.opacity).toBe(.25)
  expect(draw(a).style.opacity).toBe(1)
 })
 it('honours manual label controls and allows the declared clipping primitives',()=>{
  expect(draw(label('visible'),{formatting:{labels:{show:false}}})).toBeNull()
  const a=ast({type:'group',clipPath:{type:'rect',shape:{x:0,y:0,width:100,height:100}},children:[{type:'text',style:{text:op('formatNumber',.2345,'0%')}}]})
  const r=draw(a,{formatting:{labels:{fontSize:18,color:'#abcdef',format:'0.00%'}}})
  expect(r.clipPath.type).toBe('rect');expect(r.children[0].style).toMatchObject({text:'23.45%',fontSize:18,fill:'#abcdef'})
 })
})
describe('expression validation and isolation',()=>{
 it('type-checks the bounded strokeNoScale flag',()=>{
  const input=rect(1);input.root.style={strokeNoScale:'true'};expect(validateExpression(input).valid).toBe(false)
  input.root.style.strokeNoScale=true;expect(validateExpression(input).valid).toBe(true)
 })
 it.each(['eval','Function','window','fetch','get','set','loop','while','call','constructor'])('rejects unlisted operation%s with an exact path',name=>{
  const r=validateExpression(rect(op(name,1)))
  expect(r.valid).toBe(false);expect(r.errors.some(e=>e.path==='/renderItem/root/shape/x/op')).toBe(true)
 })
 it('rejects wrong types, missing shapes and unresolved/unsafe tokens',()=>{
  expect(validateExpression(rect(op('add','string',1))).errors.some(e=>e.path.endsWith('/args/0'))).toBe(true)
  expect(validateExpression(ast({type:'rect'})).errors.some(e=>e.path.endsWith('/shape/width'))).toBe(true)
  expect(validateExpression(rect('$param.width')).valid).toBe(true)
  expect(validateExpression(rect('$param.width'),{resolved:true}).valid).toBe(false)
  expect(validateExpression(rect('$theme.constructor')).valid).toBe(false)
  expect(validateExpression(rect('$slot.value.values')).valid).toBe(false)
  expect(validateExpression(rect(op('visual','symbol'))).valid).toBe(false)
 })
 it('rejects accessors/custom array methods before executing anything',()=>{
  const accessed=vi.fn();const a=label('safe');Object.defineProperty(a.root.style,'op',{enumerable:true,get:accessed})
  expect(validateExpression(a).valid).toBe(false);expect(accessed).not.toHaveBeenCalled()
  const b=rect(op('add',1,2));b.root.shape.x.args.slice=accessed
  expect(validateExpression(b).valid).toBe(false);expect(accessed).not.toHaveBeenCalled()
  expect(validateExpression(rect({op:{toString:'not callable'},args:[]})).valid).toBe(false)
  expect(validateExpression(ast({type:{toString:'not callable'}})).valid).toBe(false)
  const c=ast({type:'path',shape:{pathData:op('value',0)}})
  expect(()=>draw(c,{}, {...api,value:()=>({toString:accessed})})).toThrow('scalar text');expect(accessed).not.toHaveBeenCalled()
 })
 it('blocks prototype keys, cyclic inputs and post-validation mutation',()=>{
  const a=JSON.parse('{"language":"vilsem-expression","version":1,"root":{"type":"text","style":{"__proto__":{"polluted":true}}}}')
  expect(validateExpression(a).valid).toBe(false);expect({}.polluted).toBeUndefined()
  const cycle=rect(1);cycle.root.shape.x=cycle;expect(validateExpression(cycle).valid).toBe(false)
  const original=rect(1),renderer=createExpressionRenderer(original);original.root.shape.x=op('Function','evil')
  expect(renderer({dataIndex:0},api).shape.x).toBe(1);expect(Object.isFrozen(renderer.vilsemExpression.ast.root)).toBe(true)
 })
 it('enforces per-item and whole-visual budgets before rendering',()=>{
  const a=ast({type:'group',children:Array.from({length:2000},()=>({type:'circle',shape:{cx:0,cy:0,r:1}}))})
  expect(validateExpression(a).valid).toBe(false)
  const b=ast({type:'group',children:Array.from({length:20},()=>({type:'circle',shape:{cx:0,cy:0,r:1}}))})
  expect(()=>compileExpressionSeries({series:[{type:'custom',renderItem:b,data:Array(3000).fill(1)}]})).toThrow('whole-visual')
  expect(()=>compileExpressionSeries({series:[{type:'custom',renderItem:rect(0)}]})).toThrow('explicit data')
  expect(EXPRESSION_LIMITS.totalElements).toBe(50000)
  expect(()=>draw(rect(op('add',1,2)),{stepBudget:2})).toThrow('step budget')
  expect(()=>createExpressionRenderer(rect(1),{stepBudget:1000000})).toThrow('ceiling')
 })
 it.each([op('div',1,0),op('sqrt',-1),op('pow',2,100),op('at',[1],2)])('reports invalid numeric/index operations, never emitting NaN',expr=>expect(()=>draw(rect(expr))).toThrow())
 it.each(['M0 0 L1e999 0','M0 0<script>','M0 0 http://example.com','M0 0 L1000001 1','M0','M0 0 L1','M0 0 A1 1 0 2 0 1 1','EEEE','M0 0 Z1'])('rejects invalid/path resource input%s',path=>expect(()=>draw(ast({type:'path',shape:{pathData:path}}))).toThrow(/path/))
 it('does not turn inert strings into executable capabilities',()=>{
  const fetch=vi.fn(),fn=vi.fn(),evalFn=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubGlobal('Function',fn);vi.stubGlobal('eval',evalFn)
  try{
   for(const name of ['Function','eval','fetch','window','constructor'])expect(validateExpression(rect(op(name,'return process'))).valid).toBe(false)
   const r=draw(label('<img src=x onerror="fetch(1)">'))
   expect(r.style.text).toContain('onerror');expect(fetch).not.toHaveBeenCalled();expect(fn).not.toHaveBeenCalled();expect(evalFn).not.toHaveBeenCalled()
  }finally{vi.unstubAllGlobals()}
 })
})

describe('deterministic expression fuzz probes',()=>{
 it('executes1000bounded valid arithmetic trees without invalid output',()=>{
  let seed=0x57313
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const expression=depth=>{
   if(!depth||random()<.3)return Math.floor(random()*20)-10
   const kind=Math.floor(random()*5)
   if(kind===0)return op('add',expression(depth-1),expression(depth-1))
   if(kind===1)return op('sub',expression(depth-1),expression(depth-1))
   if(kind===2)return op('mul',expression(depth-1),expression(depth-1))
   if(kind===3)return op('abs',expression(depth-1))
   return op('div',expression(depth-1),1+Math.floor(random()*10))
  }
  for(let i=0;i<1000;i++){const a=rect(op('clamp',expression(4),-100,100));expect(validateExpression(a).valid).toBe(true);const result=draw(a);expect(Number.isFinite(result.shape.x)).toBe(true);expect(Math.abs(result.shape.x)).toBeLessThanOrEqual(100)}
 })
 it('rejects1000out-of-grammar capability/prototype/shape mutations',()=>{
  for(let i=0;i<1000;i++){
   const a=rect(1)
   if(i%5===0)a.root.shape.x=op(['fetch','eval','Function','call','while'][Math.floor(i/5)%5],1)
   else if(i%5===1)a.root.style.image='https://invalid.example/pixel'
   else if(i%5===2)a.root.style.fill='url(https://invalid.example/pixel)'
   else if(i%5===3)a.root.shape.x=op('at',[1,2],'constructor')
   else a.root.shape.width=-1
   expect(validateExpression(a).valid).toBe(false)
  }
 })
})
