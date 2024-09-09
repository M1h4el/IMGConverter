import React, { useState, useCallback, useEffect } from "react";
import "./App.css";
import ExcelJS from "exceljs";
import { useDropzone } from "react-dropzone";
import { Box, Button, Typography } from "@mui/material";
import { getPerformance } from "firebase/performance";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

function App() {
  const [contador, setContador] = useState(1);
  const [selectedImages, setSelectedImages] = useState([]);
  const [keyValuePairs, setKeyValuePairs] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("2023-09");

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
  const perf = getPerformance();

  const onDrop = useCallback((acceptedFiles) => {
    setSelectedImages(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: "image/*",
    multiple: true,
  });

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
    console.log("Mes seleccionado:", event.target.value);

    let arrayDate = event.target.value.split("-");
    let yearInput = arrayDate[0];
    let monthInput = arrayDate[1];

    console.log(yearInput, monthInput);
  };

  

  const getCounter = async (month, year) => {
    try {
      const q = query(
        collection(db, "ImgProcessed"),
        where("Mes", "==", month),
        where("Año", "==", year)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        let total = 0;
        querySnapshot.forEach((doc) => {
          total += doc.data().Contador || 0;
        });
        setContador(total);
        return total;
      } else {
        let newMonth = parseInt(month);
        let newYear = parseInt(year);

        if (newMonth === 12) {
          newMonth = 1;
          newYear += 1;
        } else {
          newMonth += 1;
        }

        const newDocRef = await addDoc(collection(db, "ImgProcessed"), {
          Mes: newMonth,
          Año: newYear,
          Contador: 0,
        });

        const newDocSnapshot = await getDoc(newDocRef);
        const newContador = newDocSnapshot.data().Contador;

        setContador(newContador);
        return newContador;
      }
    } catch (e) {
      console.error("Error al obtener o crear el documento: ", e);
    }
  };

  useEffect(() => {
    const [year, month] = selectedMonth.split("-");
    getCounter(month, year);
  }, [selectedMonth]);

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

      setKeyValuePairs(localResults);
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

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${now.toString()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
              backgroundColor: "rgb(168, 41, 41);", // Color de fondo deseado
              color: "#fff", // Color del texto
              "&:hover": {
                backgroundColor: "#4d4d60", // Color de fondo en hover
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
      <div>
        <label htmlFor="monthPicker">Selecciona un mes: </label>
        <input
          id="monthPicker"
          type="month"
          min="2024-08"
          max="2024-12"
          value={selectedMonth} // El valor del input es el estado
          onChange={handleMonthChange} // Función que se ejecuta al cambiar el mes
        />
        <p>Mes seleccionado: {selectedMonth}</p>
      </div>
    </>
  );
}

export default App;
