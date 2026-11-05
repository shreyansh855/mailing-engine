let optionsButtons = document.querySelectorAll(".option-button")
let advOptionButtons = document.querySelectorAll(".adv-option-button")
let fontName = document.getElementById("fontName")
let fontSize = document.getElementById("fontSize")
let writingArea = document.getElementById("editedText")
let linkButton = document.getElementById("createLink")
let alignButtons = document.querySelectorAll(".align")
let spacingButtons = document.querySelectorAll(".spacing")
let formatButtons = document.querySelectorAll(".format")
let scriptButtons = document.querySelectorAll(".script")

// List of fonts
let fontList = [
	"Arial",
	"Verdana",
	"Times New Roman",
	"Georgia",
	"Courier New",
	"Cursive",
]

// Initial settings
const initializer = () => {
	// function calls for highlighting buttons
	highlighter(alignButtons, true)
	highlighter(spacingButtons, true)
	highlighter(formatButtons, false)
	highlighter(scriptButtons, true)

	// options for font names
	fontList.forEach((value) => {
		let option = document.createElement("option")
		option.value = value
		option.innerHTML = value
		fontName.appendChild(option)
	})

	// options for font size
	for (let i = 1; i <= 7; i++) {
		let option = document.createElement("option")
		option.value = i
		option.innerHTML = i
		fontSize.appendChild(option)
	}

	// default size
	fontSize.value = 3
}

// main logic
const modifyText = (command, defaultUi, value) => {
	// execCommand executes command on selected text
	document.execCommand(command, defaultUi, value)
}

// for basic operations - don't need value parameters
optionsButtons.forEach((button) => {
	button.addEventListener("click", () => {
		modifyText(button.id, false, null)
	})
})

// for operations with values
advOptionButtons.forEach((button) => {
	button.addEventListener("change", () => {
		modifyText(button.id, false, button.value)
	})
})

// link
linkButton.addEventListener("click", () => {
	let userLink = prompt("Enter a URL")
	if (!userLink) return;
	// if link has http then pass, else add https
	if (/^https?:\/\//i.test(userLink)) {
		modifyText(linkButton.id, false, userLink)
	} else {
		userLink = "http://" + userLink
		modifyText(linkButton.id, false, userLink)
	}
})

// Highlight clicked button
function highlighter(elements, needsRemoval) {
	elements.forEach((button) => {
		button.addEventListener("click", () => {
			if (needsRemoval) {
				let alreadyActive = false

				if (button.classList.contains("active")) {
					alreadyActive = true
				}

				highlighterRemover(elements)
				if (!alreadyActive) {
					button.classList.add("active")
				}
			} else {
				button.classList.toggle("active")
			}
		})
	})
}

function highlighterRemover(elements) {
	elements.forEach((button) => {
		button.classList.remove("active")
	})
}

window.onload = initializer;

