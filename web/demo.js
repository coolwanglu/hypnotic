//google analytics
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){ (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o), m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m) })(window,document,'script','//www.google-analytics.com/analytics.js','ga'); ga('create', 'UA-46194653-1', 'coolwanglu.github.io'); ga('send', 'pageview');

//github api
//credits: http://resume.github.io/
function get_github_user_stars (username) {
    var repos = [];
    $.ajax({
        url: 'https://api.github.com/users/' + username + '/starred',
        async: false,
        dataType: 'json',
        success: function(json) {
            repos = json;
        }
    });
    return repos;
}

function is_github_user_starred_hypnotic (username) {
    return get_github_user_stars(username).some(function(item) {
        return item.full_name == 'coolwanglu/hypnotic';
    });
}

function load_github_user_gists (username) {
    var gists = [];
    $.ajax({
        url: 'https://api.github.com/users/' + username + '/gists',
        async: false,
        dataType: 'json',
        success: function(json) {
            gists = json;
        }
    });
    return gists;
}

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

    document.getElementById('link-try-your-own').addEventListener('click', function() {
        $('#try-your-own').collapse('show');
    });

    var btn_list_gist = document.getElementById('btn-list-github-user-gist');
    btn_list_gist.addEventListener('click', function() {
        btn_list_gist.disabled = true;
        // I don't know why .collapse() won't work, so manage the classes my self
        $('#alert-not-opt-in').removeClass('in');
        $('#alert-gist-not-found').removeClass('in');
        $('#user-gists-container').removeClass('in');
        setTimeout(function() {
            try {
                var username = document.getElementById('github-username').value;
                if(!is_github_user_starred_hypnotic(username)) {
                    $('#alert-not-opt-in').addClass('in');
                    return;
                } 
                
                var gists = load_github_user_gists(username);
                if(gists.length == 0) {
                    $('#alert-gist-not-found').addClass('in');
                    return;
                }
                $('#user-gists-container').addClass('in');
                var $user_lists_ele = $('#user-gists');
                $user_lists_ele.empty();
                gists.forEach(function(gist) {
                  try {
                      var gist_id = gist.id
                      var any = false;
                      var $file_list = $('<div class="list-group collapse"></div>');
                      var files = gist.files;
                      for(var fn in files) {
                        try {
                          var file_obj = files[fn];
                          var $file_e = $('<a href="#" class="list-group-item">' + file_obj.filename + '</a>');
                          $file_e.on('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            load_github_user_gist_raw_file(gist_id, fn);      
                            return false;
                          });
                          $file_list.append($file_e);
                          any = true;
                        } catch(e) {}
                      }
                      var $entry = $('<p class="list-group-item-text">Empty Gist</p>');
                      if(any) {
                        var $entry = $('<a href="#" class="list-group-item"><h4 class="list-group-item-heading">' + gist.description + '</h4></a>'); 
                        $entry.append($file_list);
                        $entry.on('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            $file_list.collapse('toggle');
                            return false;
                        });
                      }
                      $user_lists_ele.append($entry);
                  } catch(e) { }
                });
            } finally {
                btn_list_gist.disabled = false;
            }
        }, 1);
        return false;
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
