/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import {
  makeMap,
  no
} from 'shared/util'
import {
  isNonPhrasingTag
} from 'web/compiler/util'
import {
  unicodeRegExp
} from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr(value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

// 解析html，生成AST语法树
export function parseHTML(html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag // 栈内最后一个标签
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      // 匹配到开始标签
      if (textEnd === 0) {
        // Comment:
        // 注释部分
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')
          // index大于0说明有注释内容
          if (commentEnd >= 0) {
            // 保留注释内容的选项，默认是不保留
            if (options.shouldKeepComment) {
              // 注释节点生成ASTnode插入
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            // 推迟
            advance(commentEnd + 3)
            continue
          }
        }

        // ie浏览器的加载样式节点的注释: <!--[if !IE]>--><link href="non-ie.css" rel="stylesheet"><!--<![endif]-->
        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // 文档类型申明相关
        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          // 直接截取掉不作处理
          advance(doctypeMatch[0].length)
          continue
        }

        // 结束标签
        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          // 截取标签长度字符
          advance(endTagMatch[0].length)
          // 对结束标签做处理
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // 开始标签处理，用来收集标签内的全部属性
        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          // pre、textArea标签特殊处理
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        // 如果<标签前任然有文本，截取文本之后的内容
        rest = html.slice(textEnd)
        // 这里循环匹配结束后，就会textEnd就会指向下一个作为左标签的<
        while (
          // 非结束标签、非开始标签、非注释，则<符号是作为文本内容的
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        // 左标签前的文本内容
        text = html.substring(0, textEnd)
      }
      // 没有左标签，纯文本
      if (textEnd < 0) {
        text = html
      }
      // html推文本的长度
      if (text) {
        advance(text.length)
      }
      // 对文本内容进行AST格式化处理
      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    }
    //  处理是script,style,textarea
    else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        //匹配tag标签是pre,textarea，并且第二个参数的第一个字符是回车键
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, {
          start: index + html.length
        })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance(n) {
    index += n
    html = html.substring(n)
  }

  // 处理开始标签
  function parseStartTag() {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      // 截取
      advance(start[0].length)
      // end为开始标签的末尾>
      let end, attr
      // 若下个标签不是>，并且能匹配到属性
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        // 下个属性的索引
        attr.start = index
        // 截取属性长度
        advance(attr[0].length)
        attr.end = index
        // 属性推入数组
        match.attrs.push(attr)
      }
      // 开始标签匹配结束
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        // 这个标签全部内容
        return match
      }
    }
  }

  function handleStartTag(match) {
    const tagName = match.tagName //开始标签名称
    const unarySlash = match.unarySlash //如果是/>标签 则unarySlash 是/。 如果是>标签 则unarySlash 是空
    // html
    if (expectHTML) {
      // 判断栈内最后一个标签是否是p(父标签是否是p)，并且自己是双标签
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        // 最后一个p元素出栈
        parseEndTag(lastTag)
      }
      //判断标签是否是 'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'并且上个标签和当前匹配的标签相同
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        // 同名标签出栈
        parseEndTag(tagName)
      }
    }

    // 单标签
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    // 循环匹配收集的属性数组
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      // a标签的处理
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href' ?
        options.shouldDecodeNewlinesForHref :
        options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    // 非单标签直接入栈
    if (!unary) {
      // 这里的stack是parseHtml函数的局部栈，和index下面的全局栈基本相同
      stack.push({
        tag: tagName,
        lowerCasedTag: tagName.toLowerCase(),
        attrs: attrs,
        start: match.start,
        end: match.end
      })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag(tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      // 全部转小写
      lowerCasedTagName = tagName.toLowerCase()
      // 循环栈匹配栈内上一个同名的标签
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      // 无匹配结果
      pos = 0
    }
    // 有匹配结果
    if (pos >= 0) {
      // Close all the open elements, up the stack
      // 这里会把匹配到的标签，包括标签的子标签都执行end方法（大部分情况下，匹配的标签应该是最后一个标签，但估计是自闭标签会有影响）
      for (let i = stack.length - 1; i >= pos; i--) {
        // 这里若最后一个节点不是匹配节点，发出警告
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`, {
              start: stack[i].start,
              end: stack[i].end
            }
          )
        }
        if (options.end) {
          // 匹配标签出栈，修改指针指向
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    }
    // 无匹配结果后，若标签为</br>
    else if (lowerCasedTagName === 'br') {
      if (options.start) {
        // 生成节点推入栈中，经过测试</br>和<br>同样处理换行
        options.start(tagName, [], true, start, end)
      }
    }
    // p标签插入指针子节点中
    else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}