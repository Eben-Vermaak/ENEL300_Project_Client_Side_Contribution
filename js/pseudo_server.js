// pseudo_server.js
// A tiny local server that (1) serves the student client's static files,
// exactly like Live Server would, and (2) adds a real POST endpoint that
// can actually write incoming comment data to test.json on disk.
//
// Run with terminal:  node pseudo_server.js
//            
// Then open: http://localhost:3000/Entry_page.html

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'pseudo_database.json');
const FEEDBACK_FILE = path.join(__dirname, 'pseudo_feedback_database.json');
const FEEBACK_PNG_FILE = path.join(__dirname + '/../', 'images/graph.png');

app.use(express.json());          // lets us read JSON request bodies
app.use(express.static(__dirname + '/../')); // serves student_client.html/js/css etc.

// Read whatever is currently in pseudo_database.json, defaulting to an empty array
// if the file is empty or missing.
function readData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        if (!raw.trim()) return [];
        return JSON.parse(raw);
    } catch (err) {
        console.error('Could not read test.json, starting fresh:', err.message);
        return [];
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Same idea as readData()/writeData() above, but for the lecture feedback
// (positive/neutral/negative) saved separately in pseudo_feedback.json.
function readFeedback() {
    try {
        const raw = fs.readFileSync(FEEDBACK_FILE, 'utf8');
        if (!raw.trim()) return [];
        return JSON.parse(raw);
    } catch (err) {
        console.error('Could not read pseudo_feedback.json, starting fresh:', err.message);
        return [];
    }
}

function writeFeedback(data) {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));
}


// The endpoint the client's fetch() call hits. Every submitted post
// gets appended as a new entry, so nothing gets overwritten.
app.post('/api/posts/', (req, res) => {
    const entry = req.body;
    // console.log("entry type:", typeof entry)

    if (!entry || typeof entry !== 'object') {
        return res.status(400).json({ error: 'Expected a JSON object body.' });
    }


    // read JSON file
    const json_data_before = readData();
    // console.log("data type returned from readData():", typeof json_data_before);
    // console.log("json_data_before:", json_data_before);
    // update data
    
    const post_state_current = entry;
    // console.log(`current state of post id ${i}:`, post_state_current)

    const post_state_before = json_data_before.find(p => p.postId === post_state_current.postId);
    if (post_state_before) {
        post_state_before.likes = post_state_current.likes;
        
    } else {
        json_data_before.push(post_state_current);
    }
   
    // Write the updated data back to the JSON file
    // console.log(`json_data_before after modification:`, json_data_before)
    writeData(json_data_before);


    console.log('Saved entry:', entry);
    res.status(201).json({ ok: true, count: json_data_before.length });
});

// Optional: lets you GET http://localhost:3000/posts to see everything
// that's been saved so far, handy for debugging.
app.get('/api/posts/', (req, res) => {
    res.json(readData());
});



// Lets the lecturer soft-delete (or restore) a single post by flag,
// instead of resending the whole posts array.
app.post('/api/posts/:postId/flag/delete', (req, res) => {
    const postId = Number(req.params.postId);
    const { deleted } = req.body;

    if (typeof deleted !== 'boolean') {
        return res.status(400).json({ error: 'Expected a JSON body like { "deleted": true }.' });
    }

    const data = readData();
    const post = data.find(p => p.postId === postId);
    if (!post) {
        return res.status(404).json({ error: `No post with postId ${postId}.` });
    }

    post.flags = {
        ...(post.flags || {}),
        deleted,
        deletedAt: deleted ? new Date().getTime() : null,
    };
    writeData(data);

    console.log(`Post ${postId} flags.deleted -> ${deleted}`);
    res.json({ ok: true, post });
});

app.post('/api/posts/:postId/flag/answer', (req, res) => {
    const postId = Number(req.params.postId);
    const { answered } = req.body;
    console.log("answered: ", answered);

    if (typeof answered !== 'boolean') {
        return res.status(400).json({ error: 'Expected a JSON body like { "answered": true }.' });
    }

    const data = readData();
    const post = data.find(p => p.postId === postId);
    if (!post) {
        return res.status(404).json({ error: `No post with postId ${postId}.` });
    }
    console.log("works until flags are changed");

    post.flags = {
        ...(post.flags || {}),
        answered,
        answeredAt: answered ? new Date().getTime() : null
    };
    console.log("works until data written");
    writeData(data);

    console.log(`Post ${postId} flags.answered -> ${answered}`);
    res.json({ ok: true, post });
});

// The endpoint the feedback widget's fetch() call hits. Every submission
// is pushed onto whatever's already in pseudo_feedback.json, so a user's
// earlier ratings are kept rather than overwritten.
app.post('/api/feedback/', (req, res) => {
    const entry = req.body;
    const validValues = ['positive', 'neutral', 'negative'];
 
    if (!entry || typeof entry !== 'object' || !validValues.includes(entry.value)) {
        return res.status(400).json({ error: `Expected a JSON object with "value" set to one of: ${validValues.join(', ')}.` });
    }
 
    const feedbackData = readFeedback();
    feedbackData.push({
        value: entry.value,
        timestamp: entry.timestamp || new Date().toISOString()
    });
    writeFeedback(feedbackData);
 
    console.log('Saved feedback:', entry.value);
    res.status(201).json({ ok: true, count: feedbackData.length });
});
 

app.get('/api/feedback/', (req, res) => {
    res.json(readFeedback());
});

app.get('/api/feedback/image', (req, res) => {
    // console.log("the function got called");
    fs.readFile(FEEBACK_PNG_FILE, (err, data) => {
        if(err) {
            res.writeHead(404, {"content-type":"text/plain"});
            res.end("Image not found");
        } else {
            res.end(data);
        }
    });
});


app.listen(PORT, () => {
    console.log(`Student app running at http://localhost:${PORT}/Entry_page.html`);
});