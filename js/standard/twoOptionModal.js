/****************************************************************************
 * twoOptionModal.js
 * openacousticdevices.info
 * March 2023
 *****************************************************************************/

// Standard two option modal elements

// eslint-disable-next-line no-undef
const twoOptionModal = new bootstrap.Modal(document.getElementById('two-option-modal'), {
    backdrop: 'static',
    keyboard: false
});
const twoOptionTitle = document.getElementById('two-option-modal-title');
const twoOptionBody = document.getElementById('two-option-modal-body');
const twoOptionButton0 = document.getElementById('two-option-button0');
const twoOptionButton1 = document.getElementById('two-option-button1');

let twoOptionCallback0, twoOptionCallback1;

// Two option modal with checkbox

// eslint-disable-next-line no-undef
const twoOptionCheckModal = new bootstrap.Modal(document.getElementById('two-option-check-modal'), {
    backdrop: 'static',
    keyboard: false
});
const twoOptionCheckTitle = document.getElementById('two-option-check-modal-title');
const twoOptionCheckBody = document.getElementById('two-option-check-modal-body');
const twoOptionCheckButton0 = document.getElementById('two-option-check-button0');
const twoOptionCheckButton1 = document.getElementById('two-option-check-button1');
const twoOptionCheckCheckbox = document.getElementById('two-option-check-checkbox');
const twoOptionCheckLabel = document.getElementById('two-option-check-label');

let twoOptionCheckCallback0, twoOptionCheckCallback1;

exports.displayTwoOption = (title, body, option0Text, option0Callback, option1Text, option1Callback) => {

    twoOptionTitle.innerHTML = title;
    twoOptionBody.innerHTML = body;

    twoOptionCallback0 = option0Callback;
    twoOptionButton0.innerHTML = option0Text;

    twoOptionCallback1 = option1Callback;
    twoOptionButton1.innerHTML = option1Text;

    twoOptionModal.show();

};

twoOptionButton0.addEventListener('click', (e) => {

    if (twoOptionCallback0) {

        twoOptionCallback0(e);

        twoOptionCallback0 = null;

    }

});

twoOptionButton1.addEventListener('click', (e) => {

    if (twoOptionCallback1) {

        twoOptionCallback1(e);

        twoOptionCallback1 = null;

    }

});

exports.displayTwoOptionCheck = (title, body, option0Text, option0Callback, option1Text, option1Callback, displayCheckbox, checkboxText) => {

    twoOptionCheckTitle.innerHTML = title;
    twoOptionCheckBody.innerHTML = body;

    twoOptionCheckCallback0 = option0Callback;
    twoOptionCheckButton0.innerHTML = option0Text;

    twoOptionCheckCallback1 = option1Callback;
    twoOptionCheckButton1.innerHTML = option1Text;

    if (displayCheckbox) {

        twoOptionCheckLabel.innerHTML = checkboxText;

        twoOptionCheckLabel.style.display = '';
        twoOptionCheckCheckbox.style.display = '';

    } else {

        twoOptionCheckLabel.style.display = 'none';
        twoOptionCheckCheckbox.style.display = 'none';

    }

    twoOptionCheckModal.show();

};

exports.isChecked = () => {

    return twoOptionCheckCheckbox.checked;

};

twoOptionCheckButton0.addEventListener('click', (e) => {

    if (twoOptionCheckCallback0) {

        twoOptionCheckCallback0(e);

        twoOptionCheckCallback0 = null;

    }

});

twoOptionCheckButton1.addEventListener('click', (e) => {

    if (twoOptionCheckCallback1) {

        twoOptionCheckCallback1(e);

        twoOptionCheckCallback1 = null;

    }

});
