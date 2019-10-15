/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import {
  genStaticKeys
} from 'shared/util'
import {
  isUnaryTag,
  canBeLeftOpenTag
} from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true, //标志是html
  modules, //为虚拟dom添加staticClass，classBinding，staticStyle，styleBinding，for，alias，iterator1，iterator2，addRawAttr ，type ，key， ref，slotName或者slotScope或者slot，component或者inlineTemplate ，      plain，if ，else，elseif 属性
  directives, // 根据判断虚拟dom的标签类型是什么？给相应的标签绑定 相应的 v-model 双数据绑定代码函数，为虚拟dom添加textContent 属性，为虚拟dom添加innerHTML 属性
  isPreTag,
  isUnaryTag,
  mustUseProp,
  canBeLeftOpenTag,
  isReservedTag,
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}