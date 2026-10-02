const student_submit = document.getElementById("student-login");
const lecturer_submit = document.getElementById("lecturer-login");
const submit_login = document.getElementById("submit-login");
const student_username = document.getElementById("student-login-username");
const lecturer_password = document.getElementById("lecturer-login-password");


student_username.setAttribute('size',student_username.getAttribute('placeholder').length);
lecturer_password.setAttribute('size',lecturer_password.getAttribute('placeholder').length);


submit_login.onclick = function(event){
    if (student_submit.checked) {
        if (student_username.value) {
            localStorage.setItem("student_user_id", student_username.value);
            window.location.href = "student_forum.html";
        } else {
            window.alert("Please enter student code to enter student client")
        }
        
    } else if (lecturer_submit.checked){
        if (lecturer_password.value == "admin") {
            window.location.href = "lecturer_forum.html";
        } else {
            window.alert("Please enter correct password to enter lecturer client")
        }
        
    } else {
        window.alert("Please select a role");
    }
}