import React, { useState, useCallback, useEffect } from "react";
import "./App.css";
import moment from "moment";
import ExcelJS from "exceljs";
import { useDropzone } from "react-dropzone";
import { Box, Button, Typography } from "@mui/material";
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
  apiKey: "AIzaSyCHI4YfjzldGMnXPKZxTcSxICZh9l1SDuI",
  authDomain: "imgconverter-f66dd.firebaseapp.com",
  projectId: "imgconverter-f66dd",
  storageBucket: "imgconverter-f66dd.appspot.com",
  messagingSenderId: "896104832478",
  appId: "1:896104832478:web:7dbe4a14bc9296a2add14f",
  measurementId: "G-3H4PC5WBBX",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  let [actualDate, setActualDate] = useState("");

  let [selectedImages, setSelectedImages] = useState([]);
  let [contador, setContador] = useState(0);
  let [loading, setLoading] = useState(true);

  let [maxInputDate, setMaxInputDate] = useState(null);

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

  const handleSubmit = async () => {
    if (selectedImages.length === 0) {
      alert("Por favor, seleccione al menos una imagen.");
      return;
    }

    const API_KEY = "AIzaSyDQ9ZSK81WVQznS4Hk4dlMm7-cfdjsvf5U";

    const requests = [];

    for (const image of selectedImages) {
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(image);
        reader.onloadend = () =>
          resolve(reader.result.replace("data:", "").replace(/^.+,/, ""));
        reader.onerror = reject;
      });

      requests.push({
        image: { content: base64String },
        features: [{ type: "TEXT_DETECTION" }],
      });
    }

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requests }),
        }
      );

      const data = await response.json();
      const localResults = data.responses.map((res) =>
        parseText(res.textAnnotations?.[0]?.description || "No text found")
      );

      await incrementCounter(requests.length);

      return localResults;
    } catch (error) {
      console.error("Error processing images:", error);
    }
  };

  const parseText = (inputText) => {
    const keywords = [
      "Primary",
      "Social Security",
      "Spouse Name",
      "Address",
      "Phone Home",
      "Work",
      "Mobile",
      "Other",
      "E-Mail Primary",
    ];

    const lines = inputText.split("\n");
    const result = {};
    let currentKey = "";

    lines.forEach((line) => {
      const foundKeyword = keywords.find((keyword) => line.startsWith(keyword));

      if (foundKeyword) {
        if (currentKey) {
          result[currentKey] = result[currentKey].trim();
        }
        currentKey = foundKeyword;
        let value = line.replace(foundKeyword, "").trim();

        if (value.startsWith(":")) {
          value = value.substring(1).trim();
        }

      if (currentKey === "Social Security") {
        const splitValue = value.split("-");
        if (splitValue.length >= 3) {
          value = splitValue[2];
        } else {
          value = "";
        }
      }
        result[currentKey] = value;
      } else if (currentKey) {
        result[currentKey] += " " + line.trim();
      }
    });

    if (currentKey) {
      result[currentKey] = result[currentKey].trim();
    }

    return result;
  };

  const generateExcel = async () => {
    let getKeyValuePair = await handleSubmit();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");

    const headers = [
      "Imagen",
      ...[
        "Primary",
        "Social Security",
        "Spouse Name",
        "Address",
        "Phone Home",
        "Work",
        "Mobile",
        "Other",
        "E-Mail Primary",
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

    getKeyValuePair.forEach((data, index) => {
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
    });

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
  };

  const handleMonthChange = async (event) => {
    let arrayDate = event.target.value.split("-");
    let yearInput = arrayDate[0];
    let monthInput = arrayDate[1].replace(/^0+/, "");

    await fetchCounterDocs(parseFloat(monthInput), parseFloat(yearInput));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <div className="container">
        <Box
          {...getRootProps()}
          className="dropzone"
          sx={{
            p: 2,
            border: "2px dashed #ddd",
            borderRadius: "8px",
            textAlign: "center",
            height: "12rem",
            width: "30rem",
            transition: "background-color 0.3s ease",
            "&:hover": {
              backgroundColor: "rgb(80, 80, 80)",
            },
          }}
        >
          <input {...getInputProps()} />
          <Typography variant="body1">
            Arrastra las imágenes aquí, o haz clic para seleccionar
          </Typography>
        </Box>
        <div className="">
          {selectedImages.length > 0
            ? `${selectedImages.length} Archivos Cargados`
            : ""}
        </div>
        <div className="boxButtons">
          <Button
            color="success"
            variant="contained"
            onClick={generateExcel}
            disabled={!selectedImages.length}
          >
            Descargar .xlsx
          </Button>
          <Button
            sx={{
              backgroundColor: "rgb(168, 41, 41)",
              color: "#fff",
              "&:hover": {
                backgroundColor: "#4d4d60",
              },
            }}
            variant="contained"
            onClick={() => setSelectedImages([])}
            disabled={!selectedImages.length}
          >
            Cancelar
          </Button>
        </div>
      </div>
      <hr />
      <div className="bottomContainer">
        <label htmlFor="monthPicker">Selecciona un mes </label>
        <input
            className="inputDate"
          id="monthPicker"
          type="month"
          max={maxInputDate}
          value={actualDate}
          onChange={handleMonthChange}
        />
        <div className="detailCounter">Se han cargado<div className="counter">{contador}</div>imágenes el {actualDate} </div>
      </div>
    </>
  );
}

export default App;
