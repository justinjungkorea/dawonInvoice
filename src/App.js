import React, { useState, useRef, useEffect } from "react";
import CryptoJS from "crypto-js";

const API_KEY = "VeXTpAc1Vs7sV3G3XH07ngSOwO3JNnJGhoyVzqLR";
const CLOVA_OCR_URL = "https://7mp9e5av5z.apigw.ntruss.com/custom/v1/38457/11ee4267e5e9b2ce6c0837adb01815624b5eeabd52907a89fe55f5e99239224f/infer";
const CLOVA_SECRET_KEY = "aUZudWtkcVVvYmlsdmt1aml3SWZrQVBhbnVKV2NQdGE=";

function generateSignature(timestamp) {
  const space = " ";
  const newLine = "\n";
  const method = "POST";
  const url = CLOVA_OCR_URL;
  const accessKey = API_KEY;
  const secretKey = CLOVA_SECRET_KEY;

  const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
  hmac.update(method);
  hmac.update(space);
  hmac.update(url);
  hmac.update(newLine);
  hmac.update(timestamp);
  hmac.update(newLine);
  hmac.update(accessKey);

  return hmac.finalize().toString(CryptoJS.enc.Base64);
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    startCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("카메라 접근 실패:", error);
    }
  };

  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(sendOcrRequest, "image/jpeg");
    }
  };

  const sendOcrRequest = async (blob) => {
    setLoading(true);
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = async () => {
      const base64Image = reader.result.split(",")[1];
      const requestBody = {
        requestId: "ocr_request",
        version: "V2",
        timestamp: new Date().getTime(), 
        images: [{ format: "jpg", name: "captured_image", data: base64Image }],
      };

      try {
        let timestamp = new Date().getTime().toString();
        const signature = generateSignature(timestamp);
        const response = await fetch(CLOVA_OCR_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-OCR-SECRET": CLOVA_SECRET_KEY,
            "x-ncp-apigw-api-key": API_KEY,
            "x-ncp-apigw-timestamp": timestamp,
            "x-ncp-apigw-signature-v2": signature
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        console.log('result : ', data);
        processTableData(data);
      } catch (error) {
        console.error("OCR 요청 오류:", error);
        alert("OCR 요청 실패. 다시 시도해주세요.");
        window.location.reload();
      } finally {
        setLoading(false);
      }
    };
  };

  const processTableData = (data) => {
    if (!data.images || data.images.length === 0 || !data.images[0].fields) {
      alert("OCR 결과가 올바르지 않습니다. 다시 시도해주세요.");
      window.location.reload();
      return;
    }
    const fields = data.images[0].fields;
    const headers = fields.map(field => field.name);
    const rows = [];
    
    fields.forEach(field => {
      if (!field.inferText) field.inferText = "";
    });
    
    const maxRowLength = Math.max(...fields.map(field => (field.inferText ? field.inferText.split("\n").length : 0)));
    
    for (let i = 0; i < maxRowLength; i++) {
      const row = fields.map(field => (field.inferText.split("\n")[i] || ""));
      rows.push(row);
    }
    setTableData([headers, ...rows]);
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>Clova OCR in React</h1>
      <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: "400px" }}></video>
      <button onClick={captureImage} disabled={loading}>
        {loading ? "처리 중..." : "사진 찍기"}
      </button>
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
      {tableData.length > 0 && (
        <table border="1" style={{ marginTop: "20px", marginLeft: "auto", marginRight: "auto", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {tableData[0].map((header, index) => (
                <th key={index} style={{ padding: "8px", backgroundColor: "#f2f2f2" }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{ padding: "8px" }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
