//google analytics
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){ (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o), m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m) })(window,document,'script','//www.google-analytics.com/analytics.js','ga'); ga('create', 'UA-46194653-1', 'coolwanglu.github.io'); ga('send', 'pageview');

function load_github_user_gist_raw_file (gist_id, fn) {
    var src = document.getElementById('source');
    var err_msg = '/* Error: could not load gist */';
    $.ajax({
        url: 'https://api.github.com/gists/' + gist_id,
        async: false,
        dataType: 'json',
        success: function(json) {
            try {
                src.value = json.files[fn].content;
            } catch (e) {
                src.value = err_msg;
            }
        },
        error: function() {
            src.value = err_msg;
        }
    });
}


//UI behaviour
$(function() {
    var src = document.getElementById('source');
    src.scrollTop = src.scrollHeight;

    // scroll to the bottom of the source code after the tab is shown
    $('#link-play').on('shown.bs.tab', function() {
        src.scrollTop = src.scrollHeight;
    });

    document.getElementById('load-semaphore-demo').addEventListener('click', function() {
        load_github_user_gist_raw_file('7786903', 'Semaphore');
        $('#output').html('Here\'s the demo!');
    });

    document.getElementById('link-try-your-own').addEventListener('click', function() {
        $('#try-your-own').collapse('show');
    });

    var btn_execute = document.getElementById('execute');
    btn_execute.addEventListener('click', function() {
        btn_execute.disabled = true;
        btn_execute.innerHTML = 'Running...';
        Hypnotic.execute(src.value, function(){
            btn_execute.disabled = false;
            btn_execute.innerHTML = 'Execute!';

            setTimeout(function(){
                $('#try-your-own').collapse('show');
            }, 1500);
        });
    });
});
