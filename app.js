(() => {
  const cfg = window.GARUDAX_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_');
  const db = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (s) => document.querySelector(s);
  const form = $('#order-form'), productSelect = $('#product-select'), sizeSelect = $('#size-select');
  let products = [], selectedProduct = null;
  $('#year').textContent = new Date().getFullYear();
  const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));
  function message(text) { $('#order-error').textContent = text || ''; }
  function updatePrice() { const qty = Math.max(1, Number(form.quantity.value || 1)); $('#price-preview').textContent = selectedProduct ? `${money(selectedProduct.price * qty)} (${money(selectedProduct.price)} / ${selectedProduct.unit_label || 'unit'})` : 'Select a product'; }
  function sizesFor(p) { return Array.isArray(p.sizes) ? p.sizes : []; }
  function renderProductOptions() {
    productSelect.innerHTML = '<option value="">Choose a product</option>' + products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${money(p.price)} / ${escapeHtml(p.unit_label||'unit')}</option>`).join('');
  }
  function renderGallery() {
    const books = products.filter(p => p.active && p.category === 'colouring');
    $('#book-gallery').innerHTML = books.length ? books.map(p => `<article class="book-card">${p.image_url ? `<img src="${escapeAttr(p.image_url)}" alt="${escapeAttr(p.name)} cover">` : `<div class="book-placeholder">✿<small>COLOUR • CREATE • PLAY</small></div>`}<div class="book-card-copy"><span class="eyebrow">COLOURING BOOK</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description||'A fun colouring activity for little creators.')}</p><div class="book-card-foot"><strong>${money(p.price)}</strong><button class="btn btn-small btn-dark" data-book-order="${p.id}">Order book</button></div></div></article>`).join('') : '<div class="empty-state">Colouring books will appear here when GARUDAX adds them to the catalogue.</div>';
    $('#book-gallery').querySelectorAll('[data-book-order]').forEach(b => b.addEventListener('click', () => { productSelect.value = b.dataset.bookOrder; productSelect.dispatchEvent(new Event('change')); $('#order').scrollIntoView({behavior:'smooth'}); }));
  }
  function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  const escapeAttr = escapeHtml;
  async function loadProducts() {
    if (!db) { productSelect.innerHTML='<option value="">Connect Supabase to load products</option>'; $('#book-gallery').innerHTML='<div class="empty-state">Catalogue will appear here after the free backend is connected. See README.md.</div>'; message('Website setup incomplete: add your Supabase URL and anon key in config.js.'); return; }
    const {data,error}=await db.from('products').select('*').eq('active',true).order('created_at',{ascending:false});
    if (error) { productSelect.innerHTML='<option value="">Catalogue unavailable</option>'; $('#book-gallery').innerHTML='<div class="empty-state">Could not load the catalogue. Please try again later.</div>'; console.error(error); return; }
    products=data||[]; renderProductOptions(); renderGallery();
  }
  productSelect.addEventListener('change', () => { selectedProduct=products.find(p=>p.id===productSelect.value)||null; const opts=selectedProduct?sizesFor(selectedProduct):[]; sizeSelect.innerHTML='<option value="">Choose a size / option</option>'+opts.map(s=>`<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join(''); updatePrice(); });
  form.quantity.addEventListener('input',updatePrice);
  form.addEventListener('submit', async e => {
    e.preventDefault(); message(''); $('#order-success').hidden=true;
    if (!db) { message('Online ordering is not connected yet. Please ask the site owner to finish the Supabase setup.'); return; }
    const submit=$('#submit-order'); submit.disabled=true; submit.textContent='Submitting order…';
    try {
      const fd=new FormData(form), product=products.find(p=>p.id===fd.get('product_id'));
      if (!product) throw new Error('Please choose an available product.');
      const qty=Number(fd.get('quantity')); if (!Number.isInteger(qty)||qty<1||qty>5000) throw new Error('Quantity must be between 1 and 5000.');
      let filePath=null, file=$('#order-file').files[0];
      if (file) {
        if(file.size>15*1024*1024) throw new Error('File size must be 15 MB or less.');
        const ext=(file.name.split('.').pop()||'file').toLowerCase().replace(/[^a-z0-9]/g,'');
        filePath=`${crypto.randomUUID()}.${ext}`;
        const up=await db.storage.from('order-files').upload(filePath,file,{upsert:false,contentType:file.type||'application/octet-stream'});
        if(up.error) throw new Error('File upload failed. Please retry without the file or contact GARUDAX.');
      }
      const payload={customer_name:fd.get('customer_name').trim(),phone:fd.get('phone').trim(),address:fd.get('address').trim(),product_id:product.id,product_name:product.name,size:fd.get('size'),quantity:qty,unit_price:Number(product.price),total_price:Number(product.price)*qty,payment_method:fd.get('payment_method'),notes:(fd.get('notes')||'').trim(),file_path:filePath,status:'pending'};
      const {data,error}=await db.from('orders').insert(payload).select('id,order_number').single();
      if(error) { if(filePath) await db.storage.from('order-files').remove([filePath]); throw new Error('Order could not be saved. Please check your details and try again.'); }
      const orderNo=data.order_number||data.id;
      const box=$('#order-success'); box.hidden=false; box.innerHTML=`<strong>Order received!</strong><p>Your order number is <b>${escapeHtml(orderNo)}</b>. GARUDAX will contact you to confirm it. Payment: ${payload.payment_method==='cod'?'Cash on delivery':'UPI on delivery'}.</p><div class="success-actions"><button type="button" class="btn btn-small btn-dark" id="wa-confirm">Send optional WhatsApp message</button><button type="button" class="btn btn-small btn-outline" id="copy-order">Copy order number</button></div>`;
      $('#wa-confirm').addEventListener('click',()=>{const txt=`Hello GARUDAX, I placed order ${orderNo}. Name: ${payload.customer_name}. Product: ${payload.product_name}. Size: ${payload.size}. Quantity: ${qty}. Total: ${money(payload.total_price)}. Please confirm my order.`; const n=(cfg.WHATSAPP_NUMBER||'').replace(/\D/g,''); if(n && n!=='919999999999') window.open(`https://wa.me/${n}?text=${encodeURIComponent(txt)}`,'_blank','noopener'); else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank','noopener');});
      $('#copy-order').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(orderNo));$('#copy-order').textContent='Copied!';}catch{}});
      form.reset(); selectedProduct=null; sizeSelect.innerHTML='<option value="">Select product first</option>'; updatePrice();
    } catch(err) { message(err.message||'Something went wrong. Please try again.'); }
    finally { submit.disabled=false; submit.innerHTML='Submit order <span>↗</span>'; }
  });
  loadProducts();
})();
