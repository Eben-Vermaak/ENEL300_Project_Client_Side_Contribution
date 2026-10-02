const feedback_input = document.getElementById("feedback-input");
const forum_posts = document.getElementById("forum-posts-container");
const feedback_buttons = document.querySelectorAll('.feedback-btn');
const feedback_submit = document.getElementById('feedback-submit');
const order_selector = document.getElementById("order-select");




let update_timer = null;
let selectedFeedback = null;
let posts = [];
const LIKED_KEY = 'liked_post_ids';
let sort_popular = true;


//pointers to express endpoints in the server
var server_endpoint_posts = "/api/posts/"; // stores forum posts
var server_endpoint_feedback = "/api/feedback/"; // stores lecture feedback (positive/neutral/negative)

// This is an event listner added to question/post objects created
// assigns functionality to post objects, such as reading the "like number" of the post
forum_posts.addEventListener('click', (e) => {
    const btn = e.target.closest('.like-btn');
    if (!btn) return;

    const postId = btn.dataset.postId;
    const post = posts.find(p => String(p.postId) === postId);
    if (!post) return;

    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('.like-count');
    const likedIds = getLikedIds();

    if (btn.classList.contains('liked')) {
        post.likes -= 1;
        btn.classList.remove('liked', 'text-danger');
        btn.classList.add('text-muted');
        icon.classList.remove('fas');
        icon.classList.add('far');
        likedIds.delete(post.postId);

    } else {
        post.likes += 1;
        btn.classList.add('liked', 'text-danger');
        btn.classList.remove('text-muted');
        icon.classList.remove('far');
        icon.classList.add('fas');
        likedIds.add(post.postId); // TODO: this is the root of the like bug, its causing multiple stacks of the same id in local storage
    }

    saveLikedIds(likedIds);
    icon.textContent = ` ${post.likes}`;

    write_data(posts[0]);
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




// Used to help prevent same user from liking post multiple times
function getLikedIds() {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'));
}
function saveLikedIds(idsSet) {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...idsSet]));
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
        const cardHtml = `

            <div class="card mb-2">
                <div class="card-body p-2 p-sm-3">
                    <div class="media forum-item">
                        <a href="#" data-toggle="collapse" data-target=".forum-content">
                            <img src="Images/anon.jpg" class="mr-3 rounded-circle" width="50" alt="User" />
                        </a>
                        <div class="media-body">
                            <h6>Question</h6>
                            <p class="text-secondary">${post.content}</p>
                            <p class="text-muted">Posted <span class="text-secondary font-weight-bold">${new Date(post.realTime).toLocaleTimeString()}</span></p>
                        </div>
                        <div class="d-flex align-items-center">
                            <button class="btn btn-xs has-icon bg-transparent me-2 like-btn ${getLikedIds().has(post.postId) ? 'liked text-danger fas' : 'text-muted far'}" data-post-id="${post.postId}">
                            <i class="fa fa-heart" aria-hidden="true">${post.likes}</i> <span class="like-count"></span>
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

// Triggers when "Post" button pressed
// Adds a new post object to posts list then re-renders posts
document.getElementById("post-question").addEventListener('click', function () {
    const input_value = document.getElementById("feedback-input").value.trim();
    const username = localStorage.getItem("student_user_id")
    if(!input_value) {
        return;
    }
    let createdTime = new Date().getTime();
    posts.unshift({
        title: username, content: input_value, realTime: createdTime, likes: 0, postId: generate_hash(), flags: { deleted: false, deletedAt: null, answered: false, answeredAt: null },
    });

    console.log(posts[0]);
    write_data(posts[0]);


    renderPosts();
    feedback_input.value='';
    $('#threadModal').modal('hide');
});

// Hides "comment window" when cancel pressed
document.getElementById("cancel-feedback").addEventListener('click', function () {
    feedback_input.value = '';
    $('#threadModal').modal('hide');
})


// Currently sends posts list to pseudo_server which it then stores in JSON file pseudo_database
async function write_data(data) {
    pause_updates();

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
    } finally {
        start_updates();
    } 
}




// Lecture feedback (positive / neutral / negative), Student_client.html
// lines 86-100. Clicking one of the three buttons selects it and enables "Submit Feedback".
// Each submit sends one entry to the server, which appends it to whatever's already saved
// so a user's earlier submissions aren't overwritten.

feedback_buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
        console.log("feedback button click read");
        feedback_buttons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedFeedback = btn.dataset.value;
        feedback_submit.disabled = false;
    });
});

feedback_submit.addEventListener('click', async function () {
    console.log("submit button click read");
    
    if (!selectedFeedback) return;

    await write_feedback({
        value: selectedFeedback,
        timestamp: new Date().getTime()
    });


    // Reset the widget so it's clear the rating went through, and so the
    // user can submit feedback again later without
    // the UI still showing their old selection as active.
    feedback_buttons.forEach(b => b.classList.remove('selected'));
    selectedFeedback = null;
    feedback_submit.disabled = true;
});

// Sends one feedback entry to the server. The server appends it to the
// array already saved on disk rather than replacing it.
async function write_feedback(entry) {
    console.log("function write_feedback() triggered");

    try {
        const rawResponse = await fetch(server_endpoint_feedback, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entry)
        });

        if (!rawResponse.ok) {
            console.error('Server responded with', rawResponse.status);
            return;
        }

        const content = await rawResponse.json();
        console.log('Feedback saved:', content);
    } catch (err) {
        console.error('Failed to reach server:', err);
    }
}

// Pulls existing posts from data base and places them into post array
async function load_posts(_callback) {
    let response = await fetch(server_endpoint_posts);
    let post_list = await response.json();
    // console.log(post_list, typeof post_list);

    posts = post_list.filter(p => !(p.flags && (p.flags.deleted || p.flags.answered)));


    _callback();
}


// Generates a random 32-bit (sort of) integer
function generate_hash() {
    let minm = 1;
    let maxm = 4294967296;

    let hash = Math.floor(Math.random() * (maxm - minm + 1)) + minm;
    return hash;
}


function start_updates() {
    update_timer = setInterval(load_posts, 3000, renderPosts);
}

function pause_updates() {
    clearInterval(update_timer);
}


load_posts(renderPosts);
start_updates();
console.log("liked ids: ", getLikedIds(), typeof getLikedIds());