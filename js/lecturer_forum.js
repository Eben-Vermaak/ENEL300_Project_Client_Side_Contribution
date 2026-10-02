const feedback_input = document.getElementById("feedback-input");
const forum_posts = document.getElementById("forum-posts-container");
const option_hide_name = document.getElementById("name-option");
const option_hide_feedback = document.getElementById("feedback-option");
const option_posts_expire = document.getElementById("expire-option");
const experation_slider = document.getElementById("expire-slider");
const slider_value = document.getElementById("slider-value-display");
const feedback_container = document.getElementById("feedback-container");
const feedback_image = document.getElementById("feedback-image");
const order_selector = document.getElementById("order-select");
const delete_all_button = document.getElementById("delete-all-posts")


let posts = [];
// Simple list of flags to know current saved state in options, experation is another array due to sliding value.
let option_settings = [false, false, [false, 0]];
let option_list = [option_hide_name, option_hide_feedback, option_posts_expire];
let sort_popular = true;

//pointers to express endpoints in the server
var server_endpoint_posts = "/api/posts/"; // stores forum posts
var server_endpoint_feedback = "/api/feedback/"; // stores lecture feedback (positive/neutral/negative)



// This is an event listener added to question/post objects created
// assigns functionality to post objects
// The lecturer Client can remove messages using this
forum_posts.addEventListener('click', (e) => {
    const delete_btn = e.target.closest('.delete-btn');
    const answer_btn = e.target.closest('.answer-btn');
    if (delete_btn) {
        delete_post(Number(delete_btn.dataset.postId));
        return;
    }

    if (answer_btn) {
        answer_post(Number(answer_btn.dataset.postId));
        return;
    }
})

experation_slider.addEventListener('change', (e) => {
    slider_value.textContent = experation_slider.value + " minutes";
})

order_selector.addEventListener("change", (e) => {
    var options = order_selector.querySelectorAll("option");
    if (options[0].selected) {
        sort_popular = true;
    } else {
        sort_popular = false;
    }
    renderPosts();
})


delete_all_button.addEventListener('click', (e) => {
    pause_updates();

    posts.forEach(post => {
        delete_post(post.postId);
    });

    start_updates();
})



function slider_check() {
    if (document.getElementById("expire-option").checked) {
        document.getElementById("expire-option-expanded").style.display = "block";
    } else {
        document.getElementById("expire-option-expanded").style.display = "none";
    }
}



// Generates forum posts into visual HTML objects which is then inserted onto the page
function renderPosts() {

    if (sort_popular) {
        posts.sort(function(a, b){return b.likes - a.likes}) // Puts most liked questions on top
    } else {
        posts.sort(function(a, b){return b.realTime - a.realTime}) // Puts most recent questions on top
    }
    

    forum_posts.innerHTML = '';
    posts.forEach(function (post) {
        let post_name = (option_settings[0] == true) ? "Question" : post.title;

        const cardHtml = `

            <div class="card mb-2">
                <div class="card-body p-2 p-sm-3">
                    <div class="media forum-item">
                        <a href="#" data-toggle="collapse" data-target=".forum-content">
                            <img src="Images/anon.jpg" class="mr-3 rounded-circle" width="50" alt="User" />
                        </a>
                        <div class="media-body">
                            <h6>${post_name}</h6>
                            <p class="text-secondary">${post.content}</p>
                            <p class="text-muted">Posted <span class="text-secondary font-weight-bold">${new Date(post.realTime).toLocaleTimeString()}</span></p>
                        </div>
                        <div class="d-flex align-items-center">
                            <button class="btn btn-xs text-muted has-icon bg-transparent me-2 like-btn" data-post-id="${post.postId}">
                            <i class="fa fa-heart" aria-hidden="true">${post.likes}</i> <span class="like-count"></span>
                        </button>
                            <button class="btn btn-xs text-muted has-icon bg-transparent answer-btn" data-post-id="${post.postId}" title="Answer post">
                            <i class="fa fa-check" aria-hidden="true"></i>
                        </button>
                        </button>
                            <button class="btn btn-xs text-muted has-icon bg-transparent delete-btn" data-post-id="${post.postId}" title="Delete post">
                            <i class="fa fa-times" aria-hidden="true"></i>
                        </button>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        forum_posts.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Triggers when "Options" button pressed
// Opens window to change question timeout and other things
document.getElementById("save-options").addEventListener('click', function () {
    
    for (let i = 0; i < option_list.length - 1; i++) {
        if (option_list[i].checked) {
                option_settings[i] = true;
            } else {
                option_settings[i] = false;
            }
    }

    if (option_posts_expire.checked) {
        option_settings[option_settings.length - 1][0] = true;
        option_settings[option_settings.length - 1][1] = experation_slider.value;
    } else {
        option_settings[option_settings.length - 1][0] = false;
    }

    if (option_hide_feedback.checked) {
        feedback_container.style.display = "none";
    } else {
        feedback_container.style.display = "block";
    }


    renderPosts();
    $('#threadModal').modal('hide');
});


// Hides "options window" when cancel pressed
// resets option checks to previous state
document.getElementById("cancel-options").addEventListener('click', function () {
    $('#threadModal').modal('hide');
    
    for (let i = 0; i < option_settings.length - 1; i++) {
        if (option_settings[i] == true) {
                option_list[i].checked = true;
            } else {
                option_list[i].checked = false;
            }
    }
    if (option_settings[option_settings.length - 1][0] == true) {
        option_posts_expire.checked = true;
    } else {
        option_posts_expire.checked = false;
    }
    slider_check();
})


// Currently sends posts list to server
async function write_data(data) {

    try {
        const rawResponse = await fetch(server_endpoint_posts, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!rawResponse.ok) {
            console.error('Server responded with', rawResponse.status);
            return;
        }

        const content = await rawResponse.json();
        console.log('Saved:', content);
    } catch (err) {
        console.error('Failed to reach server:', err);
    }
}



// Soft-deletes a post: marks it flags.deleted = true on the server rather
// than actually removing it, so it disappears from every client's feed
// but is still kept in database for later analysis.
async function delete_post(postId) {
    posts = posts.filter(p => p.postId !== postId);
    renderPosts();

    try {
        const res = await fetch(`${server_endpoint_posts}${postId}/flag/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleted: true })
        });
        if (!res.ok) {
            console.error('Delete failed', postId, res.status);
            load_posts(renderPosts); // pull the real state back on failure
        }
    } catch (err) {
        console.error('Failed to reach server:', err);
        load_posts(renderPosts);
    }
}

//Same as delete_post, just changes different flags
async function answer_post(postId) {
    posts = posts.filter(p => p.postId !== postId);
    renderPosts();

    try {
        const res = await fetch(`${server_endpoint_posts}${postId}/flag/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answered: true })
        });
        if (!res.ok) {
            console.error('Answer failed', postId, res.status);
            load_posts(renderPosts); // pull the real state back on failure
        }
    } catch (err) {
        console.error('Failed to reach server:', err);
        load_posts(renderPosts);
    }
}




// Requests graph of current feedback from server and replaces current png
async function load_feedback() {
    let response = await fetch(`${server_endpoint_feedback}image`)
        .then(res=>{return res.blob()})
        .then(blob=>{
            var img = URL.createObjectURL(blob);

            feedback_image.setAttribute('src', img);
        })

}


// Pulls existing posts from data base and places them into post array
async function load_posts(_callback) {
    let response = await fetch(server_endpoint_posts);
    let post_list = await response.json();

    // hides "deleted" or "answered" posts
    posts = post_list.filter(p => !(p.flags && (p.flags.deleted || p.flags.answered)));


    // auto deletes posts if expire option selected
    if (option_settings[option_settings.length - 1][0] && posts.length >= 1) {
        let current_time = new Date().getTime();  
        let expired_posts = posts.filter(p => (((current_time - p.realTime) / 60000) >= option_settings[option_settings.length - 1][1]));
        expired_posts.forEach(post => {
            console.log("expired post ID:", post.postId);
            deletePost(post.postId);
        });
    }

    _callback();
}



function start_updates() {
    update_timer = setInterval(load_posts, 3000, renderPosts);
    feedback_update_timer = setInterval(load_feedback, 15000);
}

function pause_updates() {
    clearInterval(update_timer);
    clearInterval(feedback_update_timer);
}


start_updates();
load_feedback();
load_posts(renderPosts);
