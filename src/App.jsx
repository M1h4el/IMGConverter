import React, { useState, useCallback, useEffect, useRef } from "react";
import BounceLoader from "react-spinners/BounceLoader";
import TopLoadingBar from "react-top-loading-bar";
import uploadIcon from "./assets/humbleicons_upload.png";
import iconDropzone from "./assets/Vector2.png";
import cancelComponent from "./assets/Vector.png";
import "./App.css";
import citiesUS from "./assets/US_States_and_Cities.json";
import moment from "moment";
import ExcelJS from "exceljs";
import { useDropzone } from "react-dropzone";
import { Box, Button } from "@mui/material";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyADAMsj5SjK9decNCfazRWjBZaCGs7zSNw",
  authDomain: "imgconverter-77aca.firebaseapp.com",
  projectId: "imgconverter-77aca",
  storageBucket: "imgconverter-77aca.appspot.com",
  messagingSenderId: "272959101199",
  appId: "1:272959101199:web:91c50db0a0ad7556a4867a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  let [actualDate, setActualDate] = useState("");
  let [selectedImages, setSelectedImages] = useState([]);
  let [contador, setContador] = useState(0);
  let [xlsxLoading, setXlsxLoading] = useState(false);
  let [maxInputDate, setMaxInputDate] = useState(null);
  let [loading, setLoading] = useState(true);
  let [progressBar, setProgressBar] = useState(0);

  const loadingBarRef = useRef(null);

  const onDrop = useCallback((acceptedFiles) => {
    setSelectedImages(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: "image/*",
    multiple: true,
  });

  async function fetchCounterDocs(month, year, create = false) {
    try {
      const q = query(
        collection(db, "Contador"),
        where("Mes", "==", month),
        where("Año", "==", year)
      );

      const querySnapshot = await getDocs(q);

      const document = querySnapshot?.docs[0]?.data();

      let counter = document?.Contador;

      if (counter >= 0) {
        setContador(counter);
      } else if (create) {
        await addDoc(collection(db, "Contador"), {
          Mes: parseInt(month),
          Año: parseInt(year),
          Contador: 0,
        });
      } else {
        setContador(0);
      }

      setActualDate(`${year}-${month.toString().padStart(2, "0")}`);
    } catch (error) {
      console.error("Error al obtener los documentos: ", error);
    }

    setLoading(false);
  }

  useEffect(() => {
    let month = moment().month() + 1;
    let year = moment().year();

    setMaxInputDate(`${year}-${month.toString().padStart(2, "0")}`);

    fetchCounterDocs(month, year, true);
  }, []);

  const incrementCounter = async (numberImages) => {
    try {
      let month = moment().month() + 1;
      let year = moment().year();

      const q = query(
        collection(db, "Contador"),
        where("Mes", "==", month),
        where("Año", "==", year)
      );
      const doc = await getDocs(q);

      const document = doc?.docs[0]?.data();

      let counter = document?.Contador;

      const ref = doc?.docs[0]?.ref;

      await updateDoc(ref, { Contador: counter + numberImages });

      if (actualDate == `${year}-${month.toString().padStart(2, "0")}`)
        setContador(counter + numberImages);
    } catch (error) {
      console.error("Error al actualizar el contador: ", error);
      throw error;
    }
  };

  function cleanAndConvertToEmail(input) {
    let trimmedInput = input.trim();

    let parts = trimmedInput.split("@");

    if (parts.length !== 2) return "";

    let domainMatch = parts[1].match(/^[^ ]+\.[a-zA-Z]+/);
    if (!domainMatch) return "";

    let namePart = parts[0];

    namePart = namePart.replace(/\s/g, "");

    return namePart + "@" + domainMatch[0];
  }

  const handleSubmit = async () => {
    if (selectedImages.length === 0) {
      alert("Por favor, seleccione al menos una imagen.");
      return;
    }

    const API_KEY = "AIzaSyAGHpzVMKruh3LEXpx3a9jZFuBBt8B29oY";
    const MAX_IMAGES_PER_REQUEST = 16;

    const convertImageToBase64 = (image) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(image);
        reader.onloadend = () =>
          resolve(reader.result.replace("data:", "").replace(/^.+,/, ""));
        reader.onerror = reject;
      });
    };

    const createBatches = async (images) => {
      const batches = [];
      for (let i = 0; i < images.length; i += MAX_IMAGES_PER_REQUEST) {
        const batch = images.slice(i, i + MAX_IMAGES_PER_REQUEST);
        const batchRequests = [];
        for (const image of batch) {
          const base64String = await convertImageToBase64(image);
          batchRequests.push({
            image: { content: base64String },
            features: [{ type: "TEXT_DETECTION" }],
          });
        }
        batches.push(batchRequests);
      }
      return batches;
    };

    try {
      const imageBatches = await createBatches(selectedImages);
      const allResults = [];

      for (let batchIndex = 0; batchIndex < imageBatches.length; batchIndex++) {
        const batch = imageBatches[batchIndex];
        const response = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ requests: batch }),
          }
        );

        const data = await response.json();
        const localResults = data.responses.map((res) =>
          parseText(res.textAnnotations?.[0]?.description || "No text found")
        );

        allResults.push(...localResults);
        console.log(1, localResults);

        const progressPercentage =
          25 + (25 * (batchIndex + 1)) / imageBatches.length;
        setProgressBar(progressPercentage);
      }

      await incrementCounter(selectedImages.length);

      console.log(2, allResults);

      return allResults;
    } catch (error) {
      console.error("Error processing images:", error);
    }
  };

  function findCity(inputString) {
    const upperCity = inputString.toUpperCase();
    let result = false;

    for (const state in citiesUS) {
      citiesUS[state].forEach((city) => {
        if (upperCity.includes(city.toUpperCase())) {
          result = city.toUpperCase();
        }
      });
    }

    return result;
  }

  let lineAddress = "";

  let lineRegion = "";

  const parseText = (inputText) => {
    const keywords = [
      "Primary",
      "Social Security",
      "Spouse Name",
      "Address",
      "City",
      "State",
      "Zip Code",
      "Phone Home",
      "Work",
      "Mobile",
      "Other",
      "E-Mail Primary",
    ];

    const lines = inputText.split("\n");

    lineAddress = lines[4];
    lineRegion = lines[5];

    const result = {};
    let currentKey = "";

    lines.forEach((line) => {
      const foundKeyword = keywords.find((keyword) => line.startsWith(keyword));

      if (foundKeyword) {
        let value = line.replace(foundKeyword, "").trim();

        if (value.startsWith(":")) {
          value = value.substring(1).trim();
        }

        if (currentKey) {
          result[currentKey] = result[currentKey].trim();
        }

        currentKey = foundKeyword;

        if (currentKey === "Social Security") {
          value = value.replace(/[X-]/g, "");
        }

        result[currentKey] = value;
      } else if (currentKey) {
        result[currentKey] += " " + line.trim();
      }
    });

    if (currentKey == "E-Mail Primary") {
      let value = cleanAndConvertToEmail(result[currentKey]);
      result[currentKey] = value;
    }

    if (currentKey) {
      result[currentKey] = result[currentKey].trim();
    }

    console.log("result: ", result);

    return result;
  };

  const generateExcel = async () => {
    setXlsxLoading(true);

    if (loadingBarRef.current) {
      loadingBarRef.current.continuousStart();
    }

    let getKeyValuePair = await handleSubmit();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");

    let updatedKeyValuePair = getKeyValuePair;

    if (updatedKeyValuePair[0]["Other"] !== "") {
      updatedKeyValuePair[0][
        "Mobile"
      ] = `${updatedKeyValuePair[0]["Mobile"]} / ${updatedKeyValuePair[0]["Other"]}`;

      delete updatedKeyValuePair[0]["Other"];
    } else {
      delete getKeyValuePair[0]["Other"];
    }

    if (updatedKeyValuePair[0]["Address"] !== "") {
      const splitAddress = updatedKeyValuePair[0]["Address"].split(",");
      const address = lineAddress

      const matchZipCode =
        updatedKeyValuePair[0]["Address"].match(/\b(\d{5})-/);
      const zipCode = matchZipCode ? matchZipCode[1] : null;


      const matchState = splitAddress[1]
        ? splitAddress[1].trim().match(/^[A-Z]{2}/)
        : null;
      const state = matchState ? matchState[0] : null;

      const city = findCity(lineRegion);

      let objectAddress = {
        zipCode,
        city,
        state,
        address,
      };

      updatedKeyValuePair[0]["Zip Code"] = objectAddress.zipCode;
      updatedKeyValuePair[0]["City"] = objectAddress.city;
      updatedKeyValuePair[0]["State"] = objectAddress.state;
      updatedKeyValuePair[0]["Address"] = objectAddress.address;
    }

    const headers = [
      "Imagen",
      ...[
        "Primary",
        "Social Security",
        "Address",
        "City",
        "State",
        "Zip Code",
        "Phone Home",
        "Work",
        "Mobile",
        "E-Mail Primary",
        "Spouse Name",
      ],
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6DA34D" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    setProgressBar(35);

    console.log("getkey 2", JSON.stringify(updatedKeyValuePair));
    for (let index = 0; index < updatedKeyValuePair.length; index++) {
      const data = updatedKeyValuePair[index];
      const rowData = [selectedImages[index].name];

      headers.slice(1).forEach((header) => {
        rowData.push(data[header] || "");
      });

      const row = worksheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFB7E1CD" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      const progressPercentage =
        35 + (65 * (index + 1)) / updatedKeyValuePair.length;

      setProgressBar(progressPercentage);
    }

    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });

      column.width = maxLength < 10 ? 10 : maxLength;
    });

    setProgressBar(80);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const now = new Date();
    const formattedDate = `${now.getDate()}-${
      now.getMonth() + 1
    }-${now.getFullYear()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formattedDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setXlsxLoading(false);

    setProgressBar(100);

    if (loadingBarRef.current) {
      loadingBarRef.current.complete();
    }
  };

  const handleMonthChange = async (event) => {
    let arrayDate = event.target.value.split("-");
    let yearInput = arrayDate[0];
    let monthInput = arrayDate[1].replace(/^0+/, "");

    await fetchCounterDocs(parseFloat(monthInput), parseFloat(yearInput));
  };

  const handleImageChange = (event) => {
    let files = Array.from(event.target.files);
    files = files.map((item) => {
      item.path = item.name;
      return item;
    });
    setSelectedImages(files);
  };

  if (loading) return <BounceLoader />;
  return (
    <>
      <div className="container">
        <div className="headerContainer">
          <div className="iconUpload">
            <img src={uploadIcon} alt="" className="icon" />
          </div>
          <div className="instruccions">
            <div className="titleInst">Cargar Archivos</div>
            <div className="subTitleInst">
              Seleccione y cargue las imágenes que desee
            </div>
          </div>
          <div className="closeComponent">
            <img src={cancelComponent} alt="" />
          </div>
        </div>
        <div className="boxContainer">
          <Box
            {...getRootProps()}
            className="dropzone"
            sx={{
              p: 2,
              zIndex: 1,
              border: "2px dashed #ddd",
              borderRadius: "8px",
              textAlign: "center",
              height: "12rem",
              width: "90%",
              transition: "background-color 0.3s ease",
              "&:hover": {
                backgroundColor: "rgb(80, 80, 80)",
              },
            }}
          >
            <div className="iconDropzone">
              <img src={iconDropzone} alt="" className="iconDropzone" />
            </div>
            <input {...getInputProps()} />
            <div className="titleDropzone">
              Elija un archivo o arrástrelo y suéltelo aquí
            </div>
            <div className="format">Formato JPG & PNG, 50 MB</div>
          </Box>
        </div>
        <div className="buttonCharge">
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
          />
          <label htmlFor="fileInput" className="file-label">
            CARGAR ARCHIVOS
          </label>
        </div>
        <div className="boxButtons">
          <Button
            variant="contained"
            onClick={generateExcel}
            disabled={!selectedImages.length}
            sx={{
              display: selectedImages.length === 0 ? "none" : "block",
              width: "180px",
              backgroundColor: "#7bed91",
              color: "white",
              border: "solid green 2px",
              borderRadius: "10px",
              fontWeight: "bold",
              padding: "10px",
              "&:hover": {
                backgroundColor: "white",
                color: "green",
              },
              "@media (max-width: 690px)": {
                width: "180px",
              },
            }}
          >
            {xlsxLoading ? <BounceLoader size={15} /> : "Descargar .xlsx"}
          </Button>
          <Button
            sx={{
              display: selectedImages.length === 0 ? "none" : "block",
              backgroundColor: "#ffadad",
              fontWeight: "bold",
              color: "red",
              border: "solid 2px red",
              borderRadius: "10px",
              padding: "10px",
              "&:hover": {
                backgroundColor: "white",
              },
              "@media (max-width: 690px)": {
                width: "180px",
              },
            }}
            variant="contained"
            onClick={() => setSelectedImages([])}
            disabled={!selectedImages.length}
          >
            Cancelar
          </Button>
        </div>
        <div className="divBar">
          <TopLoadingBar
            height={7}
            color="green"
            progress={progressBar}
            onLoaderFinished={() => setProgressBar(0)}
          />
        </div>
        <div className="bottomContainer">
          <div className="leftSide">
            <input
              className="inputDate"
              id="monthPicker"
              type="month"
              max={maxInputDate}
              value={actualDate}
              onChange={handleMonthChange}
            />
            <label htmlFor="monthPicker" className="labelPicker">
              Selecciona una fecha
            </label>
          </div>
          <div className="rightSide">
            <div className="label1">Se han cargado</div>
            <div className="label2">{contador}</div>
            <div className="label3">imágenes</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
