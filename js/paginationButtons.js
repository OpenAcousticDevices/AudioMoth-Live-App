/****************************************************************************
 * paginationButtons.js
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

/**
 * @param {element} paginationElement Pagination element containing buttons
 * @param {array} values Possible values associated with pagination elements
 * @returns Value in values at selected index
 */
exports.getActiveValue = (paginationElement, values) => {

    const buttons = paginationElement.children;

    for (let i = 0; i < buttons.length; i++) {

        const button = buttons[i];

        if (button.classList.contains('active')) {

            return values[i];

        }

    }

};

/**
 * @param {element} paginationElement Pagination element containing buttons
 * @returns Index of active button
 */
exports.getActiveIndex = (paginationElement) => {

    const buttons = paginationElement.children;

    for (let i = 0; i < buttons.length; i++) {

        const button = buttons[i];

        if (button.classList.contains('active')) {

            return i;

        }

    }

};

/**
 * From a given pagination object, disable a specific button
 * @param {element} paginationElement Pagination element containing buttons
 * @param {number} disableIndex Element of button being disabled
 */
exports.disableButton = (paginationElement, disableIndex) => {

    const buttons = paginationElement.children;

    buttons[disableIndex].classList.add('disabled');

};

/**
 * From a given pagination object, enable a specific button
 * @param {element} paginationElement Pagination element containing buttons
 * @param {number} enableIndex Element of button being enabled
 */
exports.enableButton = (paginationElement, enableIndex) => {

    const buttons = paginationElement.children;

    buttons[enableIndex].classList.remove('disabled');

};

/**
 * Disable all buttons encapsulated by pagination element
 * @param {element} paginationElement Pagination element containing buttons
 */
exports.disableAll = (paginationElement) => {

    const buttons = paginationElement.children;

    for (let i = 0; i < buttons.length; i++) {

        buttons[i].classList.add('disabled');

    }

};

/**
 * Enable all buttons encapsulated by pagination element
 * @param {element} paginationElement Pagination element containing buttons
 */
exports.enableAll = (paginationElement) => {

    const buttons = paginationElement.children;

    for (let i = 0; i < buttons.length; i++) {

        buttons[i].classList.remove('disabled');

    }

};

exports.removeActiveButton = (paginationElement) => {

    const buttons = paginationElement.children;

    for (let i = 0; i < buttons.length; i++) {

        buttons[i].classList.remove('active');

    }

};

/**
 * Add active class to selected button, remove it from previous one, and run given function.
 * If the active button hasn't changed, don't run function.
 * @param {element[]} buttons Array of button elements from pagination
 * @param {number} activeIndex Index of button to be given the active class
 * @param {function} completeFunction Function to run on completion
 */
function updateActiveButton (buttons, activeIndex, completeFunction) {

    let previousSelection = -1;

    for (let i = 0; i < buttons.length; i++) {

        const button = buttons[i];

        if (button.classList.contains('active')) {

            previousSelection = i;

        }

        if (i === activeIndex) {

            button.classList.add('active');

        } else {

            button.classList.remove('active');

        }

    }

    // If the selection hasn't actually changed, don't run completeFunction

    if (activeIndex !== previousSelection) {

        completeFunction(activeIndex);

    }

}

/**
 * From a given pagination object, select a specific button
 * @param {element} paginationElement Pagination element containing buttons
 * @param {number} index Element of button being selected
 */
exports.selectActiveButton = (paginationElement, index) => {

    const buttons = paginationElement.children;

    updateActiveButton(buttons, index, () => {});

};

/**
 * Add event listener to all buttons inside pagination element
 * @param {element} paginationElement Pagination element containing buttons
 * @param {function} completeFunction Function to run once active button has been updated
 */
exports.initButtons = (paginationElement, completeFunction) => {

    const buttons = paginationElement.children;

    for (let i = 0; i < buttons.length; i++) {

        buttons[i].addEventListener('click', () => {

            if (!buttons[i].classList.contains('disabled')) {

                updateActiveButton(buttons, i, completeFunction);

            }

        });

    }

};
