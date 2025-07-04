function onFileSelected(input) {
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = onFileLoaded;
    reader.readAsDataURL(file);
}

function onFileLoaded(e) {
    var src_data = e.target.result;
    var img = new Image();
    img.onload = onImageSetted;
    img.src = src_data;
}

function onImageSetted(e) {
    var img_data = createImageData(e.target);
    document.getElementById('test_canvas').width = img_data.width;
    document.getElementById('test_canvas').height = img_data.height;
    document.getElementById('test_canvas').getContext('2d').putImageData(img_data, 0, 0);
    document.getElementById('test_canvas').img_data = img_data;
}

function createImageData(img) {
    var cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    var ct = cv.getContext('2d');
    ct.drawImage(img, 0, 0);
    return ct.getImageData(0, 0, cv.width, cv.height);
}

// グローバルキャッシュ変数
let colorCache = null;
let labCache = new Map();

function processImageData(num) {
    var cv = document.getElementById('test_canvas');
    var img_data = cv.img_data;
    
    if (!img_data) {
        alert("画像が選択されてないよ！");
        return;
    }
    
    try {
        let zip = init_zip();
        let origin_xyz = [0,0,0];
        let processed_data = cv.getContext('2d').createImageData(img_data.width, img_data.height);
        let imagecolors = new Uint8ClampedArray(img_data.width * img_data.height * 4);
        let checkbox = checkboxConfirm();

        if(num === 0){
            processed_data = greyErrorDiffusion(img_data, imagecolors, processed_data, checkbox, origin_xyz, zip[0], zip[1]);
        } else if(num === 1){
            processed_data = colorErrorDiffusion(img_data, processed_data, checkbox, origin_xyz, zip[0], zip[1]);
        } else if(num === 2){
            processed_data = colorReplaceCiede2000(img_data, processed_data, checkbox, origin_xyz, zip[0], zip[1]);
        }
        cv.getContext('2d').putImageData(processed_data, 0, 0);
    } catch(e) {
        console.error('Processing error:', e);
    }
}

function greyErrorDiffusion(img_data, imagecolors, processed_data, checkbox, origin_xyz, zip, folder) {
    // グレースケール化
    imagecolors = rgb2grey(img_data, imagecolors);

    const width = img_data.width;
    const height = img_data.height;
    
    // 誤差拡散処理
    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            // 中間色の閾値配列を初期化
            let mid_set_color = new Array(256);
            let error_add = new Array(256);
            
            for (let i = 0; i < 128; i++) {
                mid_set_color[i] = 0;
                error_add[i] = 0;
            }
            for (let i = 128; i <= 255; i++) {
                mid_set_color[i] = 255;
                error_add[i] = 255;
            }

            const index = (x + y * width) * 4;
            
            // 誤差計算（現在のピクセルの値と量子化後の値の差）
            const pixelValue = Math.round(imagecolors[index]);
            const error = imagecolors[index] - error_add[pixelValue];
            
            // ピクセルの値を設定（白か黒）
            for (let i = 0; i < 3; i++) {
                imagecolors[index + i] = mid_set_color[pixelValue];
            }
            imagecolors[index + 3] = 255; // アルファ値を255に

            // 誤差拡散（フロイド・シュタインベルグ法）
            for (let i = 0; i < 3; i++) {
                // 右
                if (x < width - 1) {
                    imagecolors[((x + 1) + y * width) * 4 + i] += (error * 5) / 16 | 0;
                }
                // 左下
                if (x > 0 && y < height - 1) {
                    imagecolors[((x - 1) + (y + 1) * width) * 4 + i] += (error * 3) / 16 | 0;
                }
                // 下 - ここが間違っていた
                if (y < height - 1) {
                    imagecolors[(x + (y + 1) * width) * 4 + i] += (error * 5) / 16 | 0;
                }
                // 右下
                if (x < width - 1 && y < height - 1) {
                    imagecolors[((x + 1) + (y + 1) * width) * 4 + i] += (error * 3) / 16 | 0;
                }
            }
        }
    }
    
    // 画像化
    for (let i = 0; i < img_data.data.length; i++) {
        processed_data.data[i] = imagecolors[i];
    }
    
    // マイクラドット絵コマンド書き込み
    let count = 0;
    let filecount = 0;
    let functionStr = '';
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            count++;
            const index = (x + y * width) * 4;
            
            // 連続する同じ色のピクセル数をカウント
            let runLength = 0;
            for (let c = 0; c < width - x; c++) {
                if (imagecolors[((x + c) + y * width) * 4] === imagecolors[index] && (x + c) < width) {
                    runLength += 1;
                } else {
                    break;
                }
            }

            // Minecraftコマンドを生成
            if (imagecolors[index] === 0) {
                functionStr += `fill ${x + origin_xyz[0]} ${origin_xyz[1]} ${y + origin_xyz[2]} ${x + origin_xyz[0] + runLength - 1} ${origin_xyz[1]} ${y + origin_xyz[2]} minecraft:black_wool\n`;
            } else if (imagecolors[index] === 255) {
                functionStr += `fill ${x + origin_xyz[0]} ${origin_xyz[1]} ${y + origin_xyz[2]} ${x + origin_xyz[0] + runLength - 1} ${origin_xyz[1]} ${y + origin_xyz[2]} minecraft:white_wool\n`;
            }
            
            // x座標を進める
            x += runLength - 1; // -1は次のforループで+1されるため
            
            // 10000コマンドごとにファイル分割
            if (count >= 10000) {
                filecount++;
                filesave(functionStr, filecount, folder);
                functionStr = "";
                count = 0;
            }
        }
    }
    
    // 残りのコマンドを保存
    filesave(functionStr, filecount, folder);
    zipDL(zip);

    return processed_data;
}

// 最適化されたCIEDE2000色置換
function colorReplaceCiede2000(img_data, processed_data, checkbox, origin_xyz, zip, folder) {
    const width = img_data.width;
    const height = img_data.height;
    
    // 色データをキャッシュから取得または生成
    if (!colorCache) {
        colorCache = loadCSVFile2(checkbox);
    }
    const color_csv = colorCache;
    const lab_array_size = color_csv[2].length;

    const output_data = new Uint8ClampedArray(img_data.data);

    // バッチ処理用の配列
    const batchSize = 1000;
    const totalPixels = width * height;
    
    for (let batch = 0; batch < totalPixels; batch += batchSize) {
        const endBatch = Math.min(batch + batchSize, totalPixels);
        
        for (let pixel = batch; pixel < endBatch; pixel++) {
            const index = pixel * 4;
            
            if (output_data[index + 3] === 0) continue; // 透明ピクセルをスキップ
            
            // RGB値をキーとしてキャッシュを確認
            const rgbKey = `${output_data[index]},${output_data[index + 1]},${output_data[index + 2]}`;
            let bestColor;
            
            if (labCache.has(rgbKey)) {
                bestColor = labCache.get(rgbKey);
            } else {
                // LAB変換と最近色検索
                const lab = rgb2lab([output_data[index], output_data[index + 1], output_data[index + 2]]);
                let minDistance = Infinity;
                let bestIndex = 0;
                
                // 最適化されたCIEDE2000計算
                for (let i = 0; i < lab_array_size; i++) {
                    const distance = ciede2000Fast(lab[0], lab[1], lab[2], 
                                                 color_csv[2][i][0], color_csv[2][i][1], color_csv[2][i][2]);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestIndex = i;
                    }
                }
                
                bestColor = color_csv[1][bestIndex];
                labCache.set(rgbKey, bestColor);
            }
            
            // 色を設定
            output_data[index] = bestColor[0];
            output_data[index + 1] = bestColor[1];
            output_data[index + 2] = bestColor[2];
        }
    }

    processed_data.data.set(output_data);
    return processed_data;
}

// 最適化された誤差拡散
function colorErrorDiffusion(img_data, processed_data, checkbox, origin_xyz, zip, folder) {
    const width = img_data.width;
    const height = img_data.height;
    
    if (!colorCache) {
        colorCache = loadCSVFile2(checkbox);
    }
    const color_csv = colorCache;
    const lab_array_size = color_csv[2].length;

    const output_data = new Uint8ClampedArray(img_data.data);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (x + y * width) * 4;
            
            if (output_data[index + 3] === 0) continue;

            // RGB値をキーとしてキャッシュを確認
            const rgbKey = `${output_data[index]},${output_data[index + 1]},${output_data[index + 2]}`;
            let bestColor;
            
            if (labCache.has(rgbKey)) {
                bestColor = labCache.get(rgbKey);
            } else {
                const lab = rgb2lab([output_data[index], output_data[index + 1], output_data[index + 2]]);
                let minDistance = Infinity;
                let bestIndex = 0;
                
                for (let i = 0; i < lab_array_size; i++) {
                    const distance = ciede2000Fast(lab[0], lab[1], lab[2], 
                                                 color_csv[2][i][0], color_csv[2][i][1], color_csv[2][i][2]);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestIndex = i;
                    }
                }
                
                bestColor = color_csv[1][bestIndex];
                labCache.set(rgbKey, bestColor);
            }

            // 誤差計算
            const error = [
                output_data[index] - bestColor[0],
                output_data[index + 1] - bestColor[1],
                output_data[index + 2] - bestColor[2]
            ];

            // 新しい色を設定
            output_data[index] = bestColor[0];
            output_data[index + 1] = bestColor[1];
            output_data[index + 2] = bestColor[2];

            // 誤差拡散（フロイド・シュタインベルグ法）
            const indices = [
                x < width - 1 ? ((x + 1) + y * width) * 4 : null,           // 右
                x > 0 && y < height - 1 ? ((x - 1) + (y + 1) * width) * 4 : null,  // 左下
                y < height - 1 ? (x + (y + 1) * width) * 4 : null,         // 下
                x < width - 1 && y < height - 1 ? ((x + 1) + (y + 1) * width) * 4 : null  // 右下
            ];
            const weights = [7, 3, 5, 1];

            for (let i = 0; i < 4; i++) {
                if (indices[i] !== null) {
                    for (let c = 0; c < 3; c++) {
                        const newValue = output_data[indices[i] + c] + (error[c] * weights[i]) / 16;
                        output_data[indices[i] + c] = Math.min(255, Math.max(0, newValue));
                    }
                }
            }
        }
    }

    processed_data.data.set(output_data);
    return processed_data;
}

// 最適化されたCIEDE2000計算（高速版）
function ciede2000Fast(L1, a1, b1, L2, a2, b2) {
    // 定数を事前計算
    const kL = 1, kC = 1, kH = 1;
    const deg2rad = Math.PI / 180;
    const rad2deg = 180 / Math.PI;
    
    const deltaL = L2 - L1;
    const L_bar = (L1 + L2) * 0.5;
    
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const C_bar = (C1 + C2) * 0.5;
    
    const C_bar7 = C_bar ** 7;
    const G = 0.5 * (1 - Math.sqrt(C_bar7 / (C_bar7 + 6103515625))); // 25^7 = 6103515625
    
    const a1_prime = a1 * (1 + G);
    const a2_prime = a2 * (1 + G);
    const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
    const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);
    const C_bar_prime = (C1_prime + C2_prime) * 0.5;
    const deltaC_prime = C2_prime - C1_prime;
    
    // hue angle calculation
    const h1_prime = Math.atan2(b1, a1_prime) * rad2deg;
    const h2_prime = Math.atan2(b2, a2_prime) * rad2deg;
    
    let deltah_prime;
    if (C1_prime * C2_prime === 0) {
        deltah_prime = 0;
    } else {
        const diff = h2_prime - h1_prime;
        if (Math.abs(diff) <= 180) {
            deltah_prime = diff;
        } else if (diff > 180) {
            deltah_prime = diff - 360;
        } else {
            deltah_prime = diff + 360;
        }
    }
    
    const deltaH_prime = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin(deltah_prime * 0.5 * deg2rad);
    
    let H_bar_prime;
    if (C1_prime * C2_prime === 0) {
        H_bar_prime = h1_prime + h2_prime;
    } else {
        const sum = h1_prime + h2_prime;
        const diff = Math.abs(h1_prime - h2_prime);
        if (diff > 180) {
            H_bar_prime = sum < 360 ? (sum + 360) * 0.5 : (sum - 360) * 0.5;
        } else {
            H_bar_prime = sum * 0.5;
        }
    }
    
    const T = 1 - 0.17 * Math.cos((H_bar_prime - 30) * deg2rad) +
              0.24 * Math.cos(2 * H_bar_prime * deg2rad) +
              0.32 * Math.cos((3 * H_bar_prime + 6) * deg2rad) -
              0.20 * Math.cos((4 * H_bar_prime - 63) * deg2rad);
    
    const L_bar_minus50_squared = (L_bar - 50) ** 2;
    const SL = 1 + (0.015 * L_bar_minus50_squared) / Math.sqrt(20 + L_bar_minus50_squared);
    const SC = 1 + 0.045 * C_bar_prime;
    const SH = 1 + 0.015 * C_bar_prime * T;
    
    const C_bar_prime7 = C_bar_prime ** 7;
    const RT = -2 * Math.sqrt(C_bar_prime7 / (C_bar_prime7 + 6103515625)) *
               Math.sin(60 * Math.exp(-1*((H_bar_prime - 275) / 25) ** 2) * deg2rad);
    
    const deltaL_over_kLSL = deltaL / (kL * SL);
    const deltaC_over_kCSC = deltaC_prime / (kC * SC);
    const deltaH_over_kHSH = deltaH_prime / (kH * SH);
    
    return Math.sqrt(
        deltaL_over_kLSL ** 2 +
        deltaC_over_kCSC ** 2 +
        deltaH_over_kHSH ** 2 +
        RT * deltaC_over_kCSC * deltaH_over_kHSH
    );
}

// 最適化されたMinecraftコマンド生成
function generateMinecraftCommands(imagecolors, width, height, origin_xyz, folder, isGrayscale = false) {
    let count = 0;
    let filecount = 0;
    let functionStr = '';
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; ) {
            const index = (x + y * width) * 4;
            const currentColor = imagecolors[index];
            
            // 連続する同じ色のピクセル数をカウント
            let runLength = 1;
            while (x + runLength < width && 
                   imagecolors[((x + runLength) + y * width) * 4] === currentColor) {
                runLength++;
            }
            
            // Minecraftコマンドを生成
            if (isGrayscale) {
                const blockType = currentColor === 0 ? "minecraft:black_wool" : "minecraft:white_wool";
                if (runLength > 1) {
                    functionStr += `fill ${x + origin_xyz[0]} ${origin_xyz[1]} ${y + origin_xyz[2]} ${x + origin_xyz[0] + runLength - 1} ${origin_xyz[1]} ${y + origin_xyz[2]} ${blockType}\n`;
                } else {
                    functionStr += `setblock ${x + origin_xyz[0]} ${origin_xyz[1]} ${y + origin_xyz[2]} ${blockType}\n`;
                }
            }
            
            x += runLength;
            count++;
            
            // ファイル分割
            if (count >= 10000) {
                filecount++;
                filesave(functionStr, filecount, folder);
                functionStr = "";
                count = 0;
            }
        }
    }
    
    if (functionStr) {
        filesave(functionStr, filecount, folder);
    }
}

// その他のヘルパー関数（最適化済み）

function checkboxConfirm() {
    return [
        document.getElementById("blockType1").checked,
        document.getElementById("blockType2").checked,
        document.getElementById("blockType3").checked
    ];
}

// 最適化されたRGB to LAB変換
function rgb2lab(rgb) {
    let [r, g, b] = rgb;
    
    // sRGB to linear RGB
    r = r > 10.31475 ? Math.pow((r / 269.025 + 0.05213), 2.4) : r / 3294.6;
    g = g > 10.31475 ? Math.pow((g / 269.025 + 0.05213), 2.4) : g / 3294.6;
    b = b > 10.31475 ? Math.pow((b / 269.025 + 0.05213), 2.4) : b / 3294.6;

    // Observer = 2°, Illuminant = D65
    let x = r * 0.4338906 + g * 0.3762349 + b * 0.1899060;
    let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let z = r * 0.0177254 + g * 0.1094753 + b * 0.8729554;

    x = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + 0.13793103;
    y = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + 0.13793103;
    z = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + 0.13793103;

    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

function rgb2hsv(rgb, array_size) {
    const hsvS = new Array(array_size);
    
    for (let i = 0; i < rgb.length; i += 4) {
        const pixelIndex = i / 4;
        const r = (rgb[i] || 0) / 255;
        const g = (rgb[i + 1] || 0) / 255;
        const b = (rgb[i + 2] || 0) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        
        let h, s, v = max;
        
        s = max === 0 ? 0 : diff / max;
        
        if (diff === 0) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
                case g: h = (b - r) / diff + 2; break;
                case b: h = (r - g) / diff + 4; break;
            }
            h /= 6;
        }
        
        hsvS[pixelIndex] = [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
    }
    
    return hsvS;
}

function rgb2grey(img_data, imagecolors) {
    const data = img_data.data;
    const width = img_data.width;
    const height = img_data.height;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (x + y * width) * 4;
            const grey = Math.round(0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]);
            
            imagecolors[index] = grey;
            imagecolors[index + 1] = grey;
            imagecolors[index + 2] = grey;
            imagecolors[index + 3] = 255;
        }
    }
    return imagecolors;
}

// 最適化されたCSV読み込み
function loadCSVFile2(checkbox) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "BlocksColor.csv", false);
    xhr.send(null);

    console.log("ブロック色のファイルは読み込めました。");

    const lines = xhr.responseText.trim().split("\n");
    const dataLines = lines.slice(1); // ヘッダーを除く
    
    const hsv_array = new Array(dataLines.length);
    const rgb_array = new Array(dataLines.length);
    const lab_array = new Array(dataLines.length);
    
    for (let i = 0; i < dataLines.length; i++) {
        const columns = dataLines[i].split(',');
        const hsv = [parseInt(columns[7]), parseInt(columns[8]), parseInt(columns[9])];
        const rgb = [parseInt(columns[1]), parseInt(columns[2]), parseInt(columns[3])];
        
        hsv_array[i] = hsv;
        rgb_array[i] = rgb;
        lab_array[i] = rgb2lab(rgb);
    }
    
    return [hsv_array, rgb_array, lab_array];
}

async function filesave(str, filecount, folder) {
    folder.file(`imagefill${filecount}.mcfunction`, str);
}

function init_zip() {
    const zip = new JSZip();
    const folder1 = zip.folder("img2MC");
    const folder2 = folder1.folder("data");
    folder1.file('pack.mcmeta', '{\n"pack": {\n"pack_format": 1,\n"description": "datapack"\n}\n}');
    const folder3 = folder2.folder("cheese");
    const folder4 = folder3.folder("functions");
    return [zip, folder4];
}

async function zipDL(zip) {
    const content = await zip.generateAsync({type: "blob"});
    saveAs(content, "img2MC.zip");
}