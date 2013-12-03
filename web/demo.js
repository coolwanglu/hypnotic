document.addEventListener('DOMContentLoaded', function() {
    var src = document.getElementById('source');
    src.scrollTop = src.scrollHeight;

    var btn = document.getElementById('execute');
    btn.addEventListener('click', function() {
        hypnotic.async_execute_script(src.value);
    });
});
