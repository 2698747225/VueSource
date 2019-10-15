/* @flow */

import {
  extend
} from 'shared/util'
import {
  detectErrors
} from './error-detector'
import {
  createCompileToFunctionFn
} from './to-function'

// 创建编译器工厂，baseCompile是把模板编译为AST语法树、优化模板、创建render函数的完整方法
export function createCompilerCreator(baseCompile: Function): Function {
  // 返回编译器
  return function createCompiler(baseOptions: CompilerOptions) {
    /** 
     * web端compile方法主要的作用是合并baseOptions和options，并且函数中也会调用baseCompile编译
     */
    function compile(
      template: string, // 字符串模板
      options ? : CompilerOptions // 模板配置相关参数，包括对标签类型、样式解析等
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      if (options) {
        // 非生产环境下
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          // 空格长度
          const leadingSpaceLength = template.match(/^\s*/)[0].length
          // 打印的警告信息
          warn = (msg, range, tip) => {
            const data: WarningMessage = {
              msg
            }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }

        // merge custom modules
        // 合并对模块中类和样式解析的配置项
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        // 合并指令配置项
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        // 合并其他，浅拷贝
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn
      // 基本编译函数
      /**
       * {
       * ast,  //AST对象
       * render:渲染函数
       * staticRenderFns:静态函数
       * }
       */
      // 这个方法实际上是真实的编辑方法
      const compiled = baseCompile(template.trim(), finalOptions)
      // 检测AST中语法是否正确
      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn)
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      /** 
       * compile(template,options){}
       * compileToFunctions(template,options,vm){}
       * compile方法额外会返回ast属性
       */
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}