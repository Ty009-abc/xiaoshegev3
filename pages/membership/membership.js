const paymentService = require('../../services/paymentService.js')
Page({ data:{ products:[], selectedProduct:null, loading:true, paying:false },
  onLoad(){ this.loadProducts() },
  async loadProducts(){
    try{
      const r=await paymentService.getProductList()
      if(r.code===0){
        let products=(r.data||[]).map(p=>({
          ...p,
          priceDisplay:(p.price/100).toFixed(2),
          durationText:'/'+p.durationDays+'天',
          originalPriceDisplay:p.originalPrice?(p.originalPrice/100).toFixed(2):'',
          perks:p.perks||['无限AI分析','完整AI报告','30天挑战','历史认知库','世界规则库'],
        }))
        // 默认选年卡（最贵=年卡）
        const annual=products.find(p=>p.durationDays>=365)||products[products.length-1]
        this.setData({ products, selectedProduct:annual })
      }
    }catch(_){} finally { this.setData({ loading:false }) }
  },
  onSelect(e){ const pid=e.currentTarget.dataset.pid; this.setData({ selectedProduct:this.data.products.find(p=>p.productId===pid) }) },
  async onPay(){
    if(!this.data.selectedProduct||this.data.paying) return
    this.setData({ paying:true })
    try{
      const r=await paymentService.createOrder(this.data.selectedProduct.productId)
      if(r.code===0){
        const order=r.data
        // 跳微信支付
        if(order.paymentParams){
          const { nonceStr, package: pkg, signType, paySign, timeStamp }=order.paymentParams
          wx.requestPayment({ timeStamp, nonceStr, package:pkg, signType, paySign, success:()=>{
            wx.redirectTo({ url:'/pages/payment-result/payment-result?orderId='+order.orderId+'&status=success' })
          }, fail:()=>{
            wx.redirectTo({ url:'/pages/payment-result/payment-result?orderId='+order.orderId+'&status=fail' })
          }})
        } else if(order._mock){
          // mock模式
          wx.showToast({ title:'支付模拟完成', icon:'success' })
          setTimeout(()=>wx.redirectTo({ url:'/pages/payment-result/payment-result?orderId='+order.orderId+'&status=success' }),1000)
        }
      } else throw new Error(r.message)
    }catch(e){ wx.showToast({ title:'支付没有完成，权益还未解锁', icon:'none' }) }
    this.setData({ paying:false })
  },
})