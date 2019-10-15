/* @flow */
/** 
 * observer传入一个对象数组类型
 * defineReactive传入对象和属性
 * 两个方法内都会循环调用遍历整个对象内的全部属性，并绑定observer
 * 能通知到视图更新只有set、del以及添加过observer的属性发生变化，所以直接添加、删除的属性是没有observer的，数组同理，添加的基础类型
 * 对象属性修改，通知的getter、setter所使用的dep中的watcher更新。如果是对象添加、删除属性，则更新的是对象__ob__上的dep里的watcher，因此对象、属性分别管理不同的dep。
 */
import Dep from './dep'
import VNode from '../vdom/vnode'
import {
  arrayMethods
} from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

// 这里能拿到全部的和数组原型方法同名的被劫持的方法名
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
  shouldObserve = value
}
/**
 *  看了下，从initData开始传入vm.$options.data到observer方法为属性建立观察者，之后会对其中每个数组类型、对象类型进行遍历，保证每个对象的都有个__ob__属性（observer实例）
 */
/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
// 一个观察者实例，构造中对对象或数组类型的数据进行getter、setter劫持
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data
  /**
   * @mock  Vue.$data
   */
  constructor(value: any) {
    this.value = value
    // 为observer实例绑定dep依赖
    this.dep = new Dep()
    // 这里绑定vmCount用来统计这个对象的被实例化次数
    this.vmCount = 0
    // 对传入的组件data的对象value绑定__ob__，可以访问observer
    // 对象类型会对$set、$del方法进行监听，会调用这里__ob__下的dep内的watcher的更新方法
    // 数组类型在push、splice、$set（其实也是调用splice），会调用到这里的dep
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      // 这里推测是为了保证这个value类型至少具备数组的全部基础方法
      if (hasProto) {
        // 如果数组存在__proto__，则指向修改为数组的原型对象
        protoAugment(value, arrayMethods)
      } else {
        // 这个对象拷贝数组原型对象的全部属性
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 数组类型会遍历数组
      this.observeArray(value)
    } else {
      // 对象类型直接绑定
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk(obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 循环遍历出所有键值
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray(items: Array < any > ) {
    // 遍历数组，给每个数组、对象类型绑定observer实例
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  // 这里重新修改数组的原型指向，指向被劫持的数组，这样就可以对特定的数组方法进行指定的视图更新
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
/**
 * @param target:数据-数组对象
 * @param src :数组原型对象
 * @param keys：数组原型对象的自身属性集合
 */
function copyAugment(target: Object, src: Object, keys: Array < string > ) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// Observer实例生成函数
export function observe(value: any, asRootData: ? boolean): Observer | void {
  // 这里的isObject里是typeOf方法，除去了null类型，意味这数组、对象不过滤
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 这里判断这个对象是否包含实例属性__ob__，这个ob是之后绑定的observer观察者实例，如果存在ob表示之前已经被劫持过，直接赋值
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    // 某些场景会设定不进行响应式
    shouldObserve &&
    // 服务器渲染相关
    !isServerRendering() &&
    // 数组或对象类型
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    // 避免组件实例对象被observer
    !value._isVue
  ) {
    // 这里建立观察者实例，只会建立一层，放入
    ob = new Observer(value)
  }
  // 判断这里的data是否是vm.$options.data。组件data的观察者会有个统计，组件被多次创建，这个值会叠加
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter ? : ? Function,
  shallow ? : boolean
) {
  // 这里创建dep依赖收集，对象中的每个属性都会有自身的dep依赖收集集合
  const dep = new Dep()
  // 过滤不可修改属性
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 为了保留原赋值的setter函数
  const getter = property && property.get
  const setter = property && property.set
  // 在绑定getter之前保存下value值
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // 为obj[key]值添加observer实例
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // 这里就是render函数渲染完成之后收集依赖的关键地方
    get: function reactiveGetter() {
      // 获取传进来的属性值的getter函数，或者闭包外的值
      const value = getter ? getter.call(obj) : val
      // 调用get方法的时机有两个，一个是在watcher实例化的时候会调用，另外就是组件模板中使用。后者直接返回
      if (Dep.target) {
        // dep收集watcher，这个dep是作用域外，这个dep不是observer上的dep。
        // 这里的dep是属性有的私有dep，作用只在于在set的时候通知更新
        dep.depend()
        // 进入这个getter方法是在render结束后，所以这个阶段从根对象到所有子对象都绑定了observer实例
        if (childOb) {
          // 同添加依赖，这里的dep是对象上的dep，所有的__ob__上的dep收集依赖都是通过这里
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter(newVal) {
      // 获取修改后的值，val是闭包获取的oldVal
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      // 闭包获取原setter，并赋值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        // 这里是这个set赋值的地方，修改了闭包外的val值，在getter中赋值
        val = newVal
      }
      // 设置新值后，为新值设置observer
      childOb = !shallow && observe(newVal)
      // 通知观察者更新，这里会通知局部变量dep下的指定watcher更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
/**
 * @param target:目标对象、或函数
 * @param key:对应属性
 * @param val:对应值
 */
// Vue.set方法
export function set(target: Array < any > | Object, key: any, val: any): any {
  // 一下方法除了最后一部是真实给对象类型
  // 过滤undefined和null以及基本类型string、number、boolean、symbol
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: `)
  }

  // 数组类型这里做了一些格式校验
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }

  // 对象类型，key本身存在对象内，并且不是原生Object原型对象的属性，直接赋值
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }

  const ob = (target).__ob__
  // 这里是避免直接修改$options.data
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // ob不存在的话，证明target对象初始化就不在data中，直接绑定到对象上
  if (!ob) {
    target[key] = val
    return val
  }

  // 为现有对象的新的key添加get、set劫持
  defineReactive(ob.value, key, val)
  // 视图更新
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 * Vue.del
 */
export function del(target: Array < any > | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: }`)
  }
  // 数组类型直接删
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 这里过滤了从原型上获取的属性
  if (!hasOwn(target, key)) {
    return
  }
  // 删
  delete target[key]
  if (!ob) {
    return
  }
  // 更
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array < any > ) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 这里所有typeof object类型都应该有__ob__
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      // 递归添加依赖
      dependArray(e)
    }
  }
}