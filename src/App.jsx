import React, { useState, useCallback } from "react";
import "./App.css";
import ExcelJS from "exceljs";
import { useDropzone } from "react-dropzone";
import { Box, Button, Typography } from "@mui/material";

function App() {
  const [selectedImages, setSelectedImages] = useState([]);
  const [keyValuePairs, setKeyValuePairs] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    setSelectedImages(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: "image/*",
    multiple: true,
  });

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
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6DA34D' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  
    getKeyValuePair.forEach((data, index) => {
      const rowData = [selectedImages[index].name];
  
      headers.slice(1).forEach((header) => {
        rowData.push(data[header] || "");
      });
  
      const row = worksheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB7E1CD' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
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
  
    // Generar el nombre de archivo con la fecha y hora actual
    const now = new Date();
    const timestamp = now.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).replace(/[/]/g, "-").replace(/[:]/g, "-"); // Reemplazar / y : para que sean válidos en nombres de archivo
  
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${timestamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
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
          '&:hover': {
            backgroundColor: 'rgb(80, 80, 80)',
          },
        }}
      >
        <input {...getInputProps()} />
        <Typography variant="body1">
          Arrastra las imágenes aquí, o haz clic para seleccionar
        </Typography>
      </Box>
      <div className="">{selectedImages.length > 0 
            ? `${selectedImages.length} Archivos Cargados` : ""}</div>
      <div className="boxButtons">
        <Button color="success"
          variant="contained"
          onClick={generateExcel}
          disabled={!selectedImages.length}
          >
          Descargar .xlsx
        </Button>
      </div>
    </div>
  );
}

export default App;
