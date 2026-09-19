// Progressive enhancement: the form also works without JS (POST /api/enquiry -> 303 back).
(function(){
  var f=document.getElementById('qualify'); if(!f||!window.fetch) return;
  var out=document.getElementById('form-status');
  f.addEventListener('submit',function(e){
    e.preventDefault(); out.className='full form-status'; out.textContent='';
    if(!f.checkValidity()){ out.className+=' err'; out.textContent='Please complete every field and tick the confirmation box.';
      var bad=f.querySelector(':invalid'); if(bad) bad.focus(); return; }
    var btn=f.querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Sending…';
    fetch(f.action,{method:'POST',body:new FormData(f),headers:{'Accept':'application/json'}})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
      .then(function(res){
        if(res.ok){ f.reset(); out.textContent='Thank you, '+(res.j.name||'')+'. We have your details and have sent a WhatsApp confirmation. We reply within two working days.';
          if(window.plausible) try{plausible('enquiry');}catch(x){} }
        else { out.className+=' err'; out.textContent=res.j.error||'Something went wrong. Please WhatsApp us instead.'; }
      })
      .catch(function(){ out.className+=' err'; out.textContent='Could not send. Please check your connection or WhatsApp us.'; })
      .then(function(){ btn.disabled=false; btn.textContent='Register interest'; out.focus&&out.setAttribute('tabindex','-1'); out.focus(); });
  });
})();
