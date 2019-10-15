/* @flow */

import {
  dirRE,
  onRE
} from './parser/index'

type Range = {
  start ? : number,
  end ? : number
};

// these keywords should not appear inside expressions, but operators like
// typeof, instanceof and in are allowed
const prohibitedKeywordRE = new RegExp('\\b' + (
  'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
  'super,throw,while,yield,delete,export,import,return,switch,default,' +
  'extends,finally,continue,debugger,function,arguments'
).split(',').join('\\b|\\b') + '\\b')

// these unary operators should not be used as property/method names
const unaryOperatorsRE = new RegExp('\\b' + (
  'delete,typeof,void'
).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)')

// strip strings in expressions
const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

// detect problematic expressions in a template
// 传入AST对象，检测模板中语法有问题的部分
export function detectErrors(ast: ? ASTNode, warn : Function) {
  if (ast) {
    checkNode(ast, warn)
  }
}

function checkNode(node: ASTNode, warn: Function) {
  // 元素element   1
  // 属性attr   2
  // 文本text   3
  if (node.type === 1) {
    // 从attrMap中获取属性名
    for (const name in node.attrsMap) {
      //判断是否是 v-或者@或者:  属性开头的
      if (dirRE.test(name)) {
        const value = node.attrsMap[name]
        if (value) {
          const range = node.rawAttrsMap[name]
          if (name === 'v-for') {
            // 检测v-for类型
            checkFor(node, `v-for="${value}"`, warn, range)
          } else if (onRE.test(name)) {
            // 检测v-on或者@绑定事件的
            checkEvent(value, `${name}="${value}"`, warn, range)
          } else {
            // 检测执行JS是否报错
            checkExpression(value, `${name}="${value}"`, warn, range)
          }
        }
      }
    }
    // 递归检测所有子元素
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        checkNode(node.children[i], warn)
      }
    }
  } else if (node.type === 2) {
    checkExpression(node.expression, node.text, warn, node)
  }
}

function checkEvent(exp: string, text: string, warn: Function, range ? : Range) {
  const stipped = exp.replace(stripStringRE, '')
  const keywordMatch: any = stipped.match(unaryOperatorsRE)
  if (keywordMatch && stipped.charAt(keywordMatch.index - 1) !== '$') {
    warn(
      `avoid using JavaScript unary operator as property name: ` +
      `"${keywordMatch[0]}" in expression ${text.trim()}`,
      range
    )
  }
  checkExpression(exp, text, warn, range)
}

function checkFor(node: ASTElement, text: string, warn: Function, range ? : Range) {
  checkExpression(node.for || '', text, warn, range)
  checkIdentifier(node.alias, 'v-for alias', text, warn, range)
  checkIdentifier(node.iterator1, 'v-for iterator', text, warn, range)
  checkIdentifier(node.iterator2, 'v-for iterator', text, warn, range)
}

function checkIdentifier(
  ident: ? string,
  type : string,
  text: string,
  warn: Function,
  range ? : Range
) {
  if (typeof ident === 'string') {
    try {
      new Function(`var ${ident}=_`)
    } catch (e) {
      warn(`invalid ${type} "${ident}" in expression: ${text.trim()}`, range)
    }
  }
}

function checkExpression(exp: string, text: string, warn: Function, range ? : Range) {
  try {
    // 和eval类似
    new Function(`return ${exp}`)
  } catch (e) {
    const keywordMatch = exp.replace(stripStringRE, '').match(prohibitedKeywordRE)
    if (keywordMatch) {
      warn(
        `avoid using JavaScript keyword as property name: ` +
        `"${keywordMatch[0]}"\n  Raw expression: ${text.trim()}`,
        range
      )
    } else {
      warn(
        `invalid expression: ${e.message} in\n\n` +
        `    ${exp}\n\n` +
        `  Raw expression: ${text.trim()}\n`,
        range
      )
    }
  }
}