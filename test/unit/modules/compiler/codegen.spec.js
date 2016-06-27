import { parse } from 'compiler/parser/index'
import { optimize } from 'compiler/optimizer'
import { generate } from 'compiler/codegen'
import { isObject } from 'shared/util'
import directives from 'web/compiler/directives/index'
import { isReservedTag } from 'web/util/index'
import { baseOptions } from 'web/compiler/index'

function assertCodegen (template, generatedCode, ...args) {
  let staticRenderFnCodes = []
  let generateOptions = baseOptions
  let proc = null
  let len = args.length
  while (len--) {
    const arg = args[len]
    if (Array.isArray(arg)) {
      staticRenderFnCodes = arg
    } else if (isObject(arg)) {
      generateOptions = arg
    } else if (typeof arg === 'function') {
      proc = arg
    }
  }
  const ast = parse(template, baseOptions)
  optimize(ast, baseOptions)
  proc && proc(ast)
  const res = generate(ast, generateOptions)
  expect(res.render).toBe(generatedCode)
  expect(res.staticRenderFns).toEqual(staticRenderFnCodes)
}

/* eslint-disable quotes */
describe('codegen', () => {
  it('generate directive', () => {
    assertCodegen(
      '<p v-custom1:arg1.modifire="value1" v-custom2><p>',
      `with(this){return _h(_e('p',{directives:[{name:"custom1",value:(value1),expression:"value1",arg:"arg1",modifiers:{"modifire":true}},{name:"custom2",arg:"arg1"}]}))}`
    )
  })

  it('generate v-for directive', () => {
    assertCodegen(
      '<li v-for="item in items" :key="item.uid"></li>',
      `with(this){return (items)&&_l((items),function(item){return _h(_e('li',{key:item.uid}))})}`
    )
    // iterator syntax
    assertCodegen(
      '<li v-for="(item, i) in items"></li>',
      `with(this){return (items)&&_l((items),function(item,i){return _h(_e('li'))})}`
    )
    assertCodegen(
      '<li v-for="(item, key, index) in items"></li>',
      `with(this){return (items)&&_l((items),function(item,key,index){return _h(_e('li'))})}`
    )
  })

  it('generate v-if directive', () => {
    assertCodegen(
      '<p v-if="show">hello</p>',
      `with(this){return (show)?_h(_e('p'),["hello"]):void 0}`
    )
  })

  it('generate v-else directive', () => {
    assertCodegen(
      '<div><p v-if="show">hello</p><p v-else>world</p></div>',
      `with(this){return _h(_e('div'),[(show)?_h(_e('p'),["hello"]):_h(_e('p'),["world"])])}`
    )
  })

  it('generate ref', () => {
    assertCodegen(
      '<p ref="component1"></p>',
      `with(this){return _h(_e('p',{ref:"component1"}))}`
    )
  })

  it('generate ref on v-for', () => {
    assertCodegen(
      '<ul><li v-for="item in items" ref="component1"></li></ul>',
      `with(this){return _h(_e('ul'),[(items)&&_l((items),function(item){return _h(_e('li',{ref:"component1",refInFor:true}))})])}`
    )
  })

  it('generate v-bind directive', () => {
    assertCodegen(
      '<p v-bind="test"></p>',
      `with(this){return _h(_e('p',{hook:{"construct":function(n1,n2){_b(n1,test)}}}))}`
    )
  })

  it('generate template tag', () => {
    assertCodegen(
      '<template><p>{{hello}}</p></template>',
      `with(this){return [_h(_e('p'),[_s(hello)])]}`
    )
  })

  it('generate svg tag', () => {
    assertCodegen(
      '<svg><text>hello world</text></svg>',
      `with(this){return _h(_e('svg',void 0,'svg'),[_h(_e('text',void 0,'svg'),["hello world"])])}`
    )
  })

  it('generate MathML tag', () => {
    assertCodegen(
      `<math>
        <matrix>
        </matrix>
      </math>`,
      `with(this){return _h(_e('math',void 0,'math'),[_h(_e('matrix',void 0,'math'))])}`
    )
  })

  it('generate single slot', () => {
    assertCodegen(
      '<slot></slot>',
      `with(this){return $slots["default"]}`
    )
  })

  it('generate named slot', () => {
    assertCodegen(
      '<slot name="one"></slot>',
      `with(this){return $slots["one"]}`
    )
  })

  it('generate slot fallback content', () => {
    assertCodegen(
      '<slot><div>hi</div></slot>',
      `with(this){return ($slots["default"]||[_m(0)])}`,
      [`with(this){return _h(_e('div'),["hi"])}`]
    )
  })

  it('generate slot target', () => {
    assertCodegen(
      '<p slot="one">hello world</p>',
      `with(this){return _h(_e('p',{slot:"one"}),["hello world"])}`
    )
  })

  it('generate class binding', () => {
    // static
    assertCodegen(
      '<p class="class1">hello world</p>',
      'with(this){return _m(0)}',
      [`with(this){return _h(_e('p',{staticClass:"class1"}),["hello world"])}`]
    )
    // dynamic
    assertCodegen(
      '<p :class="class1">hello world</p>',
      `with(this){return _h(_e('p',{class:class1}),["hello world"])}`
    )
  })

  it('generate style binding', () => {
    assertCodegen(
      '<p :style="error">hello world</p>',
      `with(this){return _h(_e('p',{style:(error)}),["hello world"])}`
    )
  })

  it('generate transition', () => {
    assertCodegen(
      '<p transition="expand">hello world</p>',
      `with(this){return _h(_e('p',{transition:"expand"}),["hello world"])}`
    )
  })

  it('generate dynamic transition with transition on appear', () => {
    assertCodegen(
      `<p :transition="{name:'expand',appear:true}">hello world</p>`,
      `with(this){return _h(_e('p',{transition:{name:'expand',appear:true}}),["hello world"])}`
    )
  })

  it('generate v-show directive', () => {
    assertCodegen(
      '<p v-show="shown">hello world</p>',
      `with(this){return _h(_e('p',{directives:[{name:"show",value:(shown),expression:"shown"}],show:true}),["hello world"])}`
    )
  })

  it('generate props with v-bind directive', () => {
    assertCodegen(
      '<p :value="msg">',
      `with(this){return _h(_e('p',{props:{"value":msg}}))}`
    )
  })

  it('generate attrs with v-bind directive', () => {
    assertCodegen(
      '<input :name="field1">',
      `with(this){return _h(_e('input',{attrs:{"name":field1}}))}`
    )
  })

  it('generate staticAttrs', () => {
    assertCodegen(
      '<input name="field1">',
      `with(this){return _m(0)}`,
      [`with(this){return _h(_e('input',{staticAttrs:{"name":"field1"}}))}`]
    )
  })

  it('generate events with v-on directive', () => {
    assertCodegen(
      '<input @input="onInput">',
      `with(this){return _h(_e('input',{on:{"input":onInput}}))}`
    )
  })

  it('generate events with keycode', () => {
    assertCodegen(
      '<input @input.enter="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){if($event.keyCode!==13)return;onInput($event)}}}))}`
    )
    // multiple keycodes (delete)
    assertCodegen(
      '<input @input.delete="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){if($event.keyCode!==8&&$event.keyCode!==46)return;onInput($event)}}}))}`
    )
    // number keycode
    assertCodegen(
      '<input @input.13="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){if($event.keyCode!==13)return;onInput($event)}}}))}`
    )
    // custom keycode
    assertCodegen(
      '<input @input.custom="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){if($event.keyCode!==_k("custom"))return;onInput($event)}}}))}`
    )
  })

  it('generate events with modifiers', () => {
    assertCodegen(
      '<input @input.stop="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){$event.stopPropagation();onInput($event)}}}))}`
    )
    assertCodegen(
      '<input @input.prevent="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){$event.preventDefault();onInput($event)}}}))}`
    )
    assertCodegen(
      '<input @input.self="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){if($event.target !== $event.currentTarget)return;onInput($event)}}}))}`
    )
  })

  it('generate events with multiple modifers', () => {
    assertCodegen(
      '<input @input.stop.prevent.self="onInput">',
      `with(this){return _h(_e('input',{on:{"input":function($event){$event.stopPropagation();$event.preventDefault();if($event.target !== $event.currentTarget)return;onInput($event)}}}))}`
    )
  })

  it('generate events with capture modifier', () => {
    assertCodegen(
      '<input @input.capture="onInput">',
      `with(this){return _h(_e('input',{on:{"!input":function($event){onInput($event)}}}))}`
    )
  })

  it('generate events with inline statement', () => {
    assertCodegen(
      '<input @input="curent++">',
      `with(this){return _h(_e('input',{on:{"input":function($event){curent++}}}))}`
    )
  })

  it('generate unhandled events', () => {
    assertCodegen(
      '<input @input="curent++">',
      `with(this){return _h(_e('input',{on:{"input":function(){}}}))}`,
      ast => {
        ast.events.input = undefined
      }
    )
  })

  it('generate multiple event handlers', () => {
    assertCodegen(
      '<input @input="curent++" @input="onInput">',
      `with(this){return _h(_e('input',{on:{"input":[function($event){curent++},onInput]}}))}`
    )
  })

  it('generate component', () => {
    assertCodegen(
      '<my-component name="mycomponent1" :msg="msg" @notify="onNotify"><div>hi</div></my-component>',
      `with(this){return _h(_e('my-component',{attrs:{"msg":msg},staticAttrs:{"name":"mycomponent1"},on:{"notify":onNotify}}),function(){return [_m(0)]})}`,
      [`with(this){return _h(_e('div'),["hi"])}`]
    )
  })

  it('generate is attribute', () => {
    assertCodegen(
      '<div is="component1"></div>',
      `with(this){return _h(_e("component1",{tag:"div"}))}`
    )
    assertCodegen(
      '<div :is="component1"></div>',
      `with(this){return _h(_e(component1,{tag:"div"}))}`
    )
  })

  it('generate component with inline-template', () => {
    // have "inline-template'"
    assertCodegen(
      '<my-component inline-template><p>hello world</p></my-component>',
      `with(this){return _h(_e('my-component',{inlineTemplate:{render:function(){with(this){return _m(0)}},staticRenderFns:[function(){with(this){return _h(_e('p'),["hello world"])}}]}}))}`
    )
    // "have inline-template attrs, but not having extactly one child element
    assertCodegen(
      '<my-component inline-template><hr><hr></my-component>',
      `with(this){return _h(_e('my-component',{inlineTemplate:{render:function(){with(this){return _m(0)}},staticRenderFns:[function(){with(this){return _h(_e('hr'))}}]}}))}`
    )
    expect('Inline-template components must have exactly one child element.').toHaveBeenWarned()
  })

  it('not specified ast type', () => {
    const res = generate(null, baseOptions)
    expect(res.render).toBe(`with(this){return _h(_e("div"))}`)
    expect(res.staticRenderFns).toEqual([])
  })

  it('not specified directives option', () => {
    assertCodegen(
      '<p v-if="show">hello world</p>',
      `with(this){return (show)?_h(_e('p'),["hello world"]):void 0}`,
      { isReservedTag }
    )
  })

  it('not specified isReservedTag option', () => {
    // this causes all tags to be treated as components,
    // thus all children are wrapped in thunks.
    assertCodegen(
      '<div><p>hello world</p></div>',
      `with(this){return _m(0)}`,
      [`with(this){return _h(_e('div'),function(){return [_h(_e('p'),function(){return ["hello world"]})]})}`],
      { directives }
    )
  })
})
/* eslint-enable quotes */