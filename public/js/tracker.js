(function(){
  var start = Date.now();
  var path = location.pathname;
  // Log page view
  fetch('/api/track', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ path: path, referrer: document.referrer || '' })
  }).catch(function(){});
  // Log duration on leave
  window.addEventListener('beforeunload', function(){
    navigator.sendBeacon('/api/track/duration', JSON.stringify({ path: path, duration_ms: Date.now() - start }));
  });
})();
