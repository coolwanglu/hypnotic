(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){ (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o), m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m) })(window,document,'script','//www.google-analytics.com/analytics.js','ga'); ga('create', 'UA-46194653-1', 'coolwanglu.github.io'); ga('send', 'pageview');

document.addEventListener('DOMContentLoaded', function() {
    var src = document.getElementById('source');
    src.scrollTop = src.scrollHeight;

    var btn = document.getElementById('execute');
    btn.addEventListener('click', function() {
        btn.disabled = true;
        btn.innerHTML = 'Running...';
        Hypnotic.execute(src.value, function(){
            btn.disabled = false;
            btn.innerHTML = 'Execute!';
        });
    });
});
