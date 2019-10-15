/* @flow */

import {
  cached
} from 'shared/util'
import {
  parseFilters
} from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array < string | {
    '@binding': string
  } >
}

// 文本类型解析，返回整合的结果
export function parseText(
  text: string,
  delimiters ? : [string, string]
): TextParseResult | void {
  // 纯文本类型格式化
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  if (!tagRE.test(text)) {
    return
  }
  // tokens用来收集字符
  const tokens = []
  const rawTokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  // 循环匹配文本
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    // 起始位置不是标签，说明开始有纯文本字符串
    if (index > lastIndex) {
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      tokens.push(JSON.stringify(tokenValue))
    }

    // tag token
    // 过滤解析{{}}中的内容，按照_s(exp)的方式插入tokens
    const exp = parseFilters(match[1].trim())
    tokens.push(`_s(${exp})`)
    rawTokens.push({
      '@binding': exp
    })
    lastIndex = index + match[0].length
  }
  // 匹配末尾阶段剩余的纯文本类型字符串
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}