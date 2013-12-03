document.addEventListener('DOMContentLoaded', function() {
    var src = document.getElementById('source');
    src.scrollTop = src.scrollHeight;

    var btn = document.getElementById('execute');
    btn.addEventListener('click', function() {
        btn.disabled = true;
        Hypnotic.execute(src.value, function(){
            btn.disabled = false;
        });
    });
});
