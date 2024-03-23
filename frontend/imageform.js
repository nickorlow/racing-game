const input = document.getElementById("image_uploads");
const preview = document.getElementById("image_previews");
const noFiles = document.getElementById("no_files");
const formContainer = document.getElementById("formContainer");
const uploadStatus = document.getElementById("uploadStatus");


input.style.opacity = 0;

function updateImageDisplay() {
  for (const file of input.files) {
    const listItem = document.createElement("div");
    const textButton = document.createElement("div")
    const para = document.createElement("p");
    const destructor = document.createElement("button");
    textButton.appendChild(para)
    textButton.appendChild(destructor)
    textButton.classList.add("flexRow", "previewInfo")
    if (validFileType(file)) {
      para.textContent = `File name ${file.name}, file size ${returnFileSize(
        file.size,
      )}.`;
      const image = document.createElement("img");
      image.src = URL.createObjectURL(file);
      image.alt = image.title = file.name;
      destructor.innerText = "x"
      destructor.type = "button"
      listItem.appendChild(textButton);
      listItem.appendChild(image);
      listItem.classList.add('imagePreview')
      preview.appendChild(listItem);
      destructor.addEventListener("click", (e) => {
        preview.removeChild(listItem)
      })

      
    }
  }
}

input.addEventListener("change", updateImageDisplay);


// https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
const fileTypes = [
  "image/apng",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/svg+xml",
  "image/tiff",
  "image/webp",
  "image/x-icon",
];

function validFileType(file) {
  return fileTypes.includes(file.type);
}

function returnFileSize(number) {
  if (number < 1024) {
    return `${number} bytes`;
  } else if (number >= 1024 && number < 1048576) {
    return `${(number / 1024).toFixed(1)} KB`;
  } else if (number >= 1048576) {
    return `${(number / 1048576).toFixed(1)} MB`;
  }
}

const button = document.getElementById("submitButton");
button.addEventListener("click", async (e) => {
  e.preventDefault();

  //creating a room
  let roomName = "hi";
  var payload = {name: roomName, balls: "balls"};
  const resp = await fetch('/room', {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      mode: "cors", // no-cors, *cors, same-origin
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "same-origin", // include, *same-origin, omit
      headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(payload) // buf, // body data type must match "Content-Type" header
  })
  const resp_json = await resp.json()
  console.log("RESPONSE " + JSON.stringify(resp_json));
  console.log("RESPONSE " + resp_json["name"]);

  //loading images
  let imageSources = Array.from(preview.children).map(e => e.lastChild.src)
  let blobs = []
  let formData = new FormData();

  let i = 0;
  for (const imageSource of imageSources) {
    console.log(imageSource)
    let res = await fetch(imageSource)
    let blob = await res.blob()
    formData.append('image_uploads', blob, `image${i}.jpg`);
    blobs.push(blob)
    i += 1
  }
  console.log(blobs)
  // preview.innerHTML = ""
  // uploadStatus.innerText = "Image uploaded!"

  console.log("Sending form data to server with data: ", formData.entries().next())
  await fetch('/room/images/' + resp_json["id"], {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      console.log(response.text());
      throw new Error('Network response was not ok');
    }
    return response.text();
  })
  .then(data => {
    console.log(data);
    preview.innerHTML = "";
    uploadStatus.innerText = "Image uploaded!";
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error);
  });

  window.location.replace(`./checkpoint.html?room_id=${resp_json["id"]}`)

});
