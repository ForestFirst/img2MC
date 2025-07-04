// CIEDEカラー距離計算
function ciede2000(L1, a1, b1, L2, a2, b2) {
    // CIE Delta E 2000アルゴリズムを実装
    // http://en.wikipedia.org/wiki/Color_difference#CIEDE2000
    var radianToDegree = function(radian) {return radian * (180 / Math.PI);};
    var degreeToRadian = function(degree) {return degree * (Math.PI / 180);};

    // 輝度の差分
    var deltaLp = L2 - L1;
    var L_ = (L1 + L2) / 2;

    // クロマ (彩度) の計算
    var C1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
    var C2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
    var C_ = (C1 + C2) / 2;

    // a'の計算 (CIE76からCIE94への修正)
    var C_7 = Math.pow(C_, 7);
    var G = 0.5 * (1 - Math.sqrt(C_7 / (C_7 + Math.pow(25, 7))));
    var ap1 = a1 * (1 + G);
    var ap2 = a2 * (1 + G);

    // 修正されたクロマ
    var Cp1 = Math.sqrt(Math.pow(ap1, 2) + Math.pow(b1, 2));
    var Cp2 = Math.sqrt(Math.pow(ap2, 2) + Math.pow(b2, 2));
    var Cp_ = (Cp1 + Cp2) / 2;
    var deltaCp = Cp2 - Cp1;

    // 色相角の計算
    var hp1 = (b1 === 0 && ap1 === 0) ? 0 : radianToDegree(Math.atan2(b1, ap1));
    if (hp1 < 0) hp1 += 360;
    
    var hp2 = (b2 === 0 && ap2 === 0) ? 0 : radianToDegree(Math.atan2(b2, ap2));
    if (hp2 < 0) hp2 += 360;

    // 色相差の計算
    var deltahp;
    if (C1 === 0 || C2 === 0) {
        deltahp = 0;
    } else if (Math.abs(hp1 - hp2) <= 180) {
        deltahp = hp2 - hp1;
    } else if (hp2 <= hp1) {
        deltahp = hp2 - hp1 + 360;
    } else {
        deltahp = hp2 - hp1 - 360;
    }

    var deltaHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(degreeToRadian(deltahp) / 2);

    // 平均色相角
    var Hp_;
    if (Math.abs(hp1 - hp2) > 180) {
        Hp_ = (hp1 + hp2 + 360) / 2;
    } else {
        Hp_ = (hp1 + hp2) / 2;
    }

    // T係数の計算
    var T = 1 -
        0.17 * Math.cos(degreeToRadian(Hp_ - 30)) +
        0.24 * Math.cos(degreeToRadian(2 * Hp_)) +
        0.32 * Math.cos(degreeToRadian(3 * Hp_ + 6)) -
        0.20 * Math.cos(degreeToRadian(4 * Hp_ - 63));

    // SL, SC, SH係数の計算
    var SL = 1 + (0.015 * Math.pow(L_ - 50, 2)) / Math.sqrt(20 + Math.pow(L_ - 50, 2));
    var SC = 1 + 0.045 * Cp_;
    var SH = 1 + 0.015 * Cp_ * T;

    // RT係数の計算
    var RT = -2 *
        Math.sqrt(Math.pow(Cp_, 7) / (Math.pow(Cp_, 7) + Math.pow(25, 7))) *
        Math.sin(degreeToRadian(60 * Math.exp(-Math.pow((Hp_ - 275) / 25, 2))));

    // 最終的な色差の計算
    return Math.sqrt(
        Math.pow(deltaLp / SL, 2) +
        Math.pow(deltaCp / SC, 2) +
        Math.pow(deltaHp / SH, 2) +
        RT * (deltaCp / SC) * (deltaHp / SH)
    );
}
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
    var data = ct.getImageData(0, 0, cv.width, cv.height);
    return data;
}

function processImageData(num) {
    var cv = document.getElementById('test_canvas');
    var img_data = cv.img_data;
    
    // 画像が選択されてるか確認
    if (!img_data) alert("画像が選択されてないよ！");
    try {
        let zip = init_zip();

        // 左上のブロック設置座標
        let origin_xyz = [0,0,0];

        let processed_data = cv.getContext('2d').createImageData(img_data.width, img_data.height);
        // 色格納
        let imagecolors = [...Array(img_data.width * img_data.height * 4)].map(k=>0);
        // チェックボックス確認
        let checkboxes = checkboxConfirm();
        
        if(num == 0){
            // 誤差拡散法
            processed_data = greyErrorDiffusion(img_data,imagecolors,processed_data,checkboxes,origin_xyz,zip[0],zip[1]);
        }
        else if(num == 1){
            processed_data = colorErrorDiffusion(img_data,processed_data,checkboxes,origin_xyz,zip[0],zip[1]);
        }
        else if(num == 2){
            processed_data = colorReplaceCiede2000(img_data,processed_data,checkboxes,origin_xyz,zip[0],zip[1]);
        }
        cv.getContext('2d').putImageData(processed_data, 0, 0);
    } catch(e) {
        console.error("エラーが発生しました:", e);
    }
}

// グレースケール誤差拡散
function greyErrorDiffusion(img_data,imagecolors,processed_data,checkboxes,origin_xyz,zip,folder){
    // グレースケール化
    imagecolors = rgb2grey(img_data,imagecolors);

    const width = img_data.width;
    const height = img_data.height;
    
    // 誤差拡散処理
    for (var y = 0; y < height - 1; y++) {
        for (var x = 0; x < width - 1; x++) {
            var mid_set_color = new Array(256);
            var error_add = new Array(256);
            for(var i = 0; i < 128; i++){
                mid_set_color[i] = 0;
                error_add[i] = 0;
            }
            for(var i = 128; i <= 255; i++){
                mid_set_color[i] = 255;
                error_add[i] = 255;
            }

            var index = (x + y * width) * 4;
            // 誤差計算
            var oldPixel = imagecolors[index];
            var newPixel = oldPixel < 128 ? 0 : 255;
            var error = oldPixel - newPixel;
            
            for(var i = 0; i < 3; i++){
                imagecolors[index + i] = newPixel;
            }

            // 誤差拡散（フロイド・スタインバーグ法）
            // 右
            if(x < width - 1){
                const rightIndex = ((x + 1) + y * width) * 4;
                for(var i = 0; i < 3; i++){
                    imagecolors[rightIndex + i] = Math.min(255, Math.max(0, imagecolors[rightIndex + i] + Math.floor((error * 7) / 16)));
                }
            }
            // 左下
            if(x > 0 && y < height - 1){
                const leftDownIndex = ((x - 1) + (y + 1) * width) * 4;
                for(var i = 0; i < 3; i++){
                    imagecolors[leftDownIndex + i] = Math.min(255, Math.max(0, imagecolors[leftDownIndex + i] + Math.floor((error * 3) / 16)));
                }
            }
            // 下
            if(y < height - 1){
                const downIndex = (x + (y + 1) * width) * 4;
                for(var i = 0; i < 3; i++){
                    imagecolors[downIndex + i] = Math.min(255, Math.max(0, imagecolors[downIndex + i] + Math.floor((error * 5) / 16)));
                }
            }
            // 右下
            if(x < width - 1 && y < height - 1){
                const rightDownIndex = ((x + 1) + (y + 1) * width) * 4;
                for(var i = 0; i < 3; i++){
                    imagecolors[rightDownIndex + i] = Math.min(255, Math.max(0, imagecolors[rightDownIndex + i] + Math.floor((error * 1) / 16)));
                }
            }
        }
    }
    
    // 画像化
    for (var i = 0; i < img_data.data.length; i++) {
        processed_data.data[i] = imagecolors[i];
    }
    
    // マイクラドット絵コマンド書き込み
    console.log("グレースケール変換完了、コマンド生成開始");
    let tmp_num;
    let count = 0;
    let filecount = 0;
    var functionStr = '';
    
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; ) {
            var index = (x + y * width) * 4;
            
            // 連続した同じ色のブロック数をカウント
            tmp_num = 0;
            for(var c = 0; c < width - x; c++) {
                if(imagecolors[((x + c) + y * width) * 4] === imagecolors[index] && (x + c) < width) {
                    tmp_num++;
                }
                else break;
            }

            // fillコマンドを生成
            if(imagecolors[index] === 0){
                functionStr += "fill " + (x + origin_xyz[0]) + " " + origin_xyz[1] + " " + (y + origin_xyz[2]) + " " + 
                              (x + origin_xyz[0] + tmp_num - 1) + " " + origin_xyz[1] + " " + (y + origin_xyz[2]) + " minecraft:black_wool\n";
            }
            else if(imagecolors[index] === 255){
                functionStr += "fill " + (x + origin_xyz[0]) + " " + origin_xyz[1] + " " + (y + origin_xyz[2]) + " " + 
                              (x + origin_xyz[0] + tmp_num - 1) + " " + origin_xyz[1] + " " + (y + origin_xyz[2]) + " minecraft:white_wool\n";
            }
            
            x += tmp_num;
            count++;
            
            if(count >= 10000){
                filecount++;
                filesave(functionStr, filecount, folder);
                functionStr = "";
                count = 0;
            }
        }
    }
    
    if(functionStr !== ""){
        filecount++;
        filesave(functionStr, filecount, folder);
    }
    
    zipDL(zip);
    console.log("グレースケール変換とコマンド生成完了");

    return processed_data;
}

function colorReplaceCiede2000(img_data,processed_data,checkboxes,origin_xyz,zip,folder){
    const width = img_data.width;
    const height = img_data.height;
    
    // 色データを読み込み
    const color_csv = loadCombinedCSVFiles(checkboxes);
    const lab_array_size = color_csv[2].length;
    
    // 色データがなければエラー
    if (lab_array_size === 0) {
        console.error("ブロックの色データが読み込めませんでした。");
        return processed_data;
    }

    console.log(`${lab_array_size}個のブロックを使用して変換します。`);
    let output_data = [...img_data.data]; // 画像の色コピー

    // 色比較
    for(var y = 0;y < height;y++){
        for(var x = 0;x < width;x++){
            const index = (x + y * width) * 4;
            
            // 透明ピクセルはスキップ
            if(output_data[index + 3] === 0) continue;
            
            let distance = [...Array(lab_array_size)].map(k=>100.0);
            // 比較
            for(var i = 0;i < lab_array_size; i++){
                let lab = rgb2lab([output_data[index],output_data[index + 1],output_data[index + 2]]);
                distance[i] = ciede2000(lab[0],lab[1],lab[2],color_csv[2][i][0],color_csv[2][i][1],color_csv[2][i][2]);
            }

            let tmp_comp_num = distance[0];
            let comp_num = 0;
            for(var i = 1;i < lab_array_size;i++){
                if(tmp_comp_num > distance[i]){
                    tmp_comp_num = distance[i];
                    comp_num = i;
                }
            }

            // 一番近い色に置き換え
            for(var i = 0;i < 3; i++){
                output_data[index + i] = color_csv[1][comp_num][i];
            }
        }
    }

    // 画像化 
    for (var i = 0;i < img_data.data.length;i++) { 
        processed_data.data[i] = output_data[i];
    }
    
    // マイクラドット絵コマンド書き込み
    generateMinecraftCommands(color_csv, output_data, width, height, origin_xyz, folder);
    zipDL(zip);
    
    return processed_data;
}

function colorErrorDiffusion(img_data,processed_data,checkboxes,origin_xyz,zip,folder){
    const width = img_data.width;
    const height = img_data.height;
    
    // 色データを読み込み
    const color_csv = loadCombinedCSVFiles(checkboxes);
    const lab_array_size = color_csv[2].length;
    
    // 色データがなければエラー
    if (lab_array_size === 0) {
        console.error("ブロックの色データが読み込めませんでした。");
        return processed_data;
    }

    console.log(`${lab_array_size}個のブロックを使用して変換します。`);
    let output_data = [...img_data.data]; // 画像の色コピー

    // 色比較
    for(var y = 0;y < height;y++){
        for(var x = 0;x < width;x++){
            const index = (x + y * width) * 4;
            
            // 透明ピクセルはスキップ
            if(output_data[index + 3] === 0) continue;
            
            let distance = [...Array(lab_array_size)].map(k=>100.0);
            // 比較
            let lab = rgb2lab([output_data[index],output_data[index + 1],output_data[index + 2]]);
            for(var i = 0;i < lab_array_size; i++){
                distance[i] = ciede2000(lab[0],lab[1],lab[2],color_csv[2][i][0],color_csv[2][i][1],color_csv[2][i][2]);
            }
            
            let tmp_comp_num = distance[0];
            let comp_num = 0;
            for(var i = 1;i < lab_array_size;i++){
                if(tmp_comp_num > distance[i]){
                    tmp_comp_num = distance[i];
                    comp_num = i;
                }
            }

            // 一番近い色に置き換え
            let error = [...Array(3)].map(k => 0);
            for(var i = 0;i < 3; i++){
                // 誤差（rgbそれぞれで算出）
                error[i] = output_data[index + i] - color_csv[1][comp_num][i];
                output_data[index + i] = color_csv[1][comp_num][i];
            }

            // 誤差拡散
            // 右
            if(x < width - 1){
                const rightIndex = ((x + 1) + y * width)*4;
                for(var i = 0;i < 3; i++){
                    output_data[rightIndex + i] = normalizeOutput(output_data[rightIndex + i] + (error[i] * 5) / 16);  
                }
            }
            // 左下
            if(x > 0 && y < height - 1){
                const leftDownIndex = ((x - 1) + (y + 1) * width)*4;
                for(var i = 0;i < 3; i++){
                    output_data[leftDownIndex + i] = normalizeOutput(output_data[leftDownIndex + i] + (error[i] * 2.8) / 16);
                }
            }
            // 下
            if(y < height - 1){
                const downIndex = (x + (y + 1) * width)*4;
                for(var i = 0;i < 3; i++){
                    output_data[downIndex + i] = normalizeOutput(output_data[downIndex + i] + (error[i] * 5) / 16);
                }
            }
            // 右下
            if(x < width - 1 && y < height - 1){
                const rightDownIndex = ((x + 1) + (y + 1) * width)*4;
                for(var i = 0;i < 3; i++){
                    output_data[rightDownIndex + i] = normalizeOutput(output_data[rightDownIndex + i] + (error[i] * 3.2) / 16);
                }
            }
        }
    }

    // 画像化 
    for (var i = 0;i < img_data.data.length;i++) { 
        processed_data.data[i] = output_data[i];
    }
    
    // マイクラドット絵コマンド書き込み
    generateMinecraftCommands(color_csv, output_data, width, height, origin_xyz, folder);
    zipDL(zip);
    
    return processed_data;
}


// マイクラドット絵コマンド生成の新しい関数
function generateMinecraftCommands(color_csv, output_data, width, height, origin_xyz, folder) {
    let count = 0;
    let filecount = 0;
    var functionStr = '';
    
    // ブロック名とブロックIDの対応表
    const blockNames = color_csv[3]; // ブロック名の配列
    
    if (!blockNames || blockNames.length === 0) {
        console.error("ブロック名データが不足しています");
        return;
    }
    
    console.log(`コマンド生成開始: ${blockNames.length}種類のブロックを使用`);
    
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            const index = (x + y * width) * 4;
            
            // 透明ピクセルはスキップ
            if (output_data[index + 3] === 0) continue;
            
            // 現在のピクセルのRGB値
            const currentR = output_data[index];
            const currentG = output_data[index + 1];
            const currentB = output_data[index + 2];
            
            // 一致するブロックを探す
            let blockIndex = -1;
            let minDiff = Number.MAX_VALUE;
            
            for (let i = 0; i < color_csv[1].length; i++) {
                const r = color_csv[1][i][0];
                const g = color_csv[1][i][1];
                const b = color_csv[1][i][2];
                
                // RGB値の差の二乗和
                const diff = Math.pow(r - currentR, 2) + Math.pow(g - currentG, 2) + Math.pow(b - currentB, 2);
                
                if (diff < minDiff) {
                    minDiff = diff;
                    blockIndex = i;
                }
            }
            
            if (blockIndex >= 0 && blockIndex < blockNames.length) {
                // 対応するブロック名を取得
                const blockName = blockNames[blockIndex];
                
                // setblockコマンドを生成
                functionStr += `setblock ${x + origin_xyz[0]} ${origin_xyz[1]} ${y + origin_xyz[2]} minecraft:${blockName}\n`;
                
                count++;
                if (count >= 10000) {
                    filecount++;
                    filesave(functionStr, filecount, folder);
                    functionStr = "";
                    count = 0;
                }
            }
        }
    }
    
    if (functionStr !== "") {
        filecount++;
        filesave(functionStr, filecount, folder);
    }
    
    console.log(`コマンド生成完了: ${filecount}個のファイルを作成`);
}

// アウトプットカラー正規化
function normalizeOutput(color) {
    if (color > 255) return 255;
    else if (color < 0) return 0;
    return Math.round(color);
}

// チェックボックス確認
function checkboxConfirm() {
    return [
        document.getElementById("blockType1").checked, // 羊毛
        document.getElementById("blockType2").checked, // コンクリート
        document.getElementById("blockType3").checked  // 固めたコンクリ
    ];
}

// 単一のCSVファイルを読み込み、チェックボックスに基づいてフィルタリングする関数
function loadCombinedCSVFiles(checkboxes) {
    // 選択されたブロックタイプを格納する配列
    const selectedTypes = [];
    
    // チェックボックスの状態に基づいてブロックタイプを選択
    if (checkboxes[0]) selectedTypes.push("wool");
    if (checkboxes[1]) selectedTypes.push("concrete");
    if (checkboxes[2]) selectedTypes.push("concrete_powder");
    
    // どのブロックタイプも選択されていない場合は、デフォルトとして全てを使用
    if (selectedTypes.length === 0) {
        selectedTypes.push("wool", "concrete", "concrete_powder");
        console.log("ブロックが選択されていないため、デフォルトとして全てのブロックを使用します。");
    }
    
    console.log("選択されたブロックタイプ:", selectedTypes);
    
    let hsv_array = [];
    let rgb_array = [];
    let lab_array = [];
    let block_names = [];
    
    // 元のCSVファイルを読み込む
    try {
        let csv = new XMLHttpRequest();
        csv.open("get", "BlocksColor.csv", false);
        csv.send(null);
        
        if (csv.status !== 200) {
            console.error("BlocksColor.csvの読み込みに失敗しました。ステータス:", csv.status);
            throw new Error("CSVファイルの読み込みに失敗しました");
        }
        
        console.log("BlocksColor.csvを読み込みました。");
        
        let str = csv.responseText;
        if (!str || str.trim() === "") {
            console.error("CSVファイルが空です");
            throw new Error("CSVファイルが空です");
        }
        
        let tmp_array = str.split("\n");
        console.log(`CSVファイルから${tmp_array.length}行を読み込みました`);
        
        // ヘッダー行をスキップし、各行を処理
        for (var i = 1; i < tmp_array.length; i++) {
            let line = tmp_array[i].trim();
            if (line === "") continue; // 空行をスキップ
            
            let columns = line.split(',');
            
            // 必要な値を取得
            if (columns.length >= 10) { // 十分な列があることを確認
                let block_name = columns[0].trim(); // ブロック名
                
                // ブロック名から種類を判断する
                let block_type = "";
                if (block_name.includes("wool")) {
                    block_type = "wool";
                } else if (block_name.includes("concrete_powder")) {
                    block_type = "concrete_powder";
                } else if (block_name.includes("concrete")) {
                    block_type = "concrete";
                } else {
                    // その他のブロックタイプ（デフォルトで含める）
                    block_type = "other";
                }
                
                // 選択されたブロックタイプか、または「other」タイプならデータを追加
                if (selectedTypes.includes(block_type) || block_type === "other") {
                    let rgb_values = [
                        parseInt(columns[1], 10) || 0,
                        parseInt(columns[2], 10) || 0, 
                        parseInt(columns[3], 10) || 0
                    ];
                    
                    let hsv_values = [
                        parseInt(columns[7], 10) || 0,
                        parseInt(columns[8], 10) || 0,
                        parseInt(columns[9], 10) || 0
                    ];
                    
                    hsv_array.push(hsv_values);
                    rgb_array.push(rgb_values);
                    lab_array.push(rgb2lab(rgb_values));
                    block_names.push(block_name);
                }
            }
        }
        
        console.log(`選択されたブロックタイプで ${hsv_array.length} 個のブロックを読み込みました。`);
        
        return [hsv_array, rgb_array, lab_array, block_names];
    } catch (e) {
        console.error("CSVファイル読み込み中にエラーが発生しました:", e);
        // エラーが発生した場合は、デフォルトの色データを返す
        return [
            [[0, 0, 0], [0, 0, 100]], // HSV
            [[0, 0, 0], [255, 255, 255]], // RGB
            [[0, 0, 0], [100, 0, 0]], // LAB
            ["black_wool", "white_wool"] // ブロック名
        ];
    }
}

// 以下の関数は変更なし

function ciede2000(L1,a1,b1, L2,a2,b2) {
    //http://en.wikipedia.org/wiki/Color_difference#CIEDE2000
    var radianToDegree = function(radian) {return radian * (180 / Math.PI);};
    var degreeToRadian = function(degree) {return degree * (Math.PI / 180);};

    var deltaLp = L2 - L1;
    var L_ = (L1 + L2) / 2;
    var C1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
    var C2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
    var C_ = (C1 + C2) / 2;
    var ap1 = a1 + (a1 / 2) *
        (1 - Math.sqrt(
            Math.pow(C_, 7) /
            (Math.pow(C_, 7) + Math.pow(25, 7))
            )
        );
    var ap2 = a2 + (a2 / 2) *
        (1 - Math.sqrt(
            Math.pow(C_, 7) /
            (Math.pow(C_, 7) + Math.pow(25, 7))
            )
        );
    var Cp1 = Math.sqrt(Math.pow(ap1, 2) + Math.pow(b1, 2));
    var Cp2 = Math.sqrt(Math.pow(ap2, 2) + Math.pow(b2, 2));
    var Cp_ = (Cp1 + Cp2) / 2;
    var deltaCp = Cp2 - Cp1;

    var hp1;
    if (b1 == 0 && ap1 == 0) {
        hp1 = 0;
    } else {
        hp1 = radianToDegree(Math.atan2(b1, ap1));
        if (hp1 < 0) {hp1 = hp1 + 360;}
    }
    var hp2;
    if (b2 == 0 && ap2 == 0) {
        hp2 = 0;
    } else {
        hp2 = radianToDegree(Math.atan2(b2, ap2));
        if (hp2 < 0) {hp2 = hp2 + 360;}
    }

    var deltahp;
    if (C1 == 0 || C2 == 0) {
        deltahp = 0;
    } else if (Math.abs(hp1 - hp2) <= 180) {
        deltahp = hp2 - hp1;
    } else if (hp2 <= hp1) {
        deltahp = hp2 - hp1 + 360;
    } else {
        deltahp = hp2 - hp1 - 360;
    }

    var deltaHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(degreeToRadian(deltahp) / 2);

    var Hp_;
    if (Math.abs(hp1 - hp2) > 180) {
        Hp_ =  (hp1 + hp2 + 360) / 2
    } else {
        Hp_ = (hp1 + hp2) / 2
    };

    var T = 1 -
        0.17 * Math.cos(degreeToRadian(Hp_ - 30)) +
        0.24 * Math.cos(degreeToRadian(2 * Hp_)) +
        0.32 * Math.cos(degreeToRadian(3 * Hp_ + 6)) -
        0.20 * Math.cos(degreeToRadian(4 * Hp_ - 63));

    var SL = 1 + (
        (0.015 * Math.pow(L_ - 50, 2)) /
        Math.sqrt(20 + Math.pow(L_ - 50, 2))
        );
    var SC = 1 + 0.045 * Cp_;
    var SH = 1 + 0.015 * Cp_ * T;

    var RT = -2 *
        Math.sqrt(
            Math.pow(Cp_, 7) /
            (Math.pow(Cp_, 7) + Math.pow(25, 7))
        ) *
        Math.sin(degreeToRadian(
            60 * Math.exp(-Math.pow((Hp_ - 275) / 25, 2))
        ));

    return Math.sqrt(
        Math.pow(deltaLp / SL, 2) +
        Math.pow(deltaCp / SC, 2) +
        Math.pow(deltaHp / SH, 2) +
        RT * (deltaCp / SC) * (deltaHp / SH)
        );
}

// RGBからLAB色空間への変換
function rgb2lab(rgb) {
    if (!rgb || rgb.length < 3) {
        console.error("無効なRGB値:", rgb);
        return [0, 0, 0]; // デフォルト値を返す
    }
    
    // RGBからXYZへの変換
    let r = rgb[0] / 255;
    let g = rgb[1] / 255;
    let b = rgb[2] / 255;

    // sRGBからリニアRGBへ
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // リニアRGBからXYZへ
    let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let z = r * 0.0193 + g * 0.1192 + b * 0.9505;

    // XYZからLABへの変換
    // 基準値 (D65照明)
    x /= 0.95047;
    y /= 1.00000;
    z /= 1.08883;

    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);

    let L = (116 * y) - 16;
    let a = 500 * (x - y);
    let b_value = 200 * (y - z);

    return [L, a, b_value];
}

function rgb2hsv(rgb,array_size){
    let r,g,b;
    let h,s,v;
    let hsvS = [...Array(array_size)].map(k=>[...Array(3)].map(k=>-1));
    for(var i = 0;i < rgb.length;i = i + 4){
        let Vmax,Vmin;

        if(rgb[i] == undefined) r = 0;
        else r = rgb[i] / 255;
        if(rgb[i + 1] == undefined) g = 0
        else g = rgb[i + 1] / 255;
        if(rgb[i + 2] == undefined) b = 0;
        else b = rgb[i + 2] / 255;
        
        Vmax = Math.max(r,g,b);
        Vmin = Math.min(r,g,b);

        if(Vmax == 0) v = 0;
        else v = Vmax * 100;

        if((Vmax - Vmin) == 0) s = 0;
        else s = (Vmax - Vmin) / Vmax * 100;
        //sが０ならhも０
        if(s == 0) h = 0;
        else {
            if(r == Vmax) h = (g - b) / (Vmax - Vmin) * (Math.PI/3);
            else if(g == Vmax) h = (b - r) / (Vmax - Vmin) * (Math.PI/3) + 2 * Math.PI / 3;
            else if(b == Vmax) h = (r - g) / (Vmax - Vmin) * (Math.PI/3) + 4 * Math.PI / 3;
        }
        //Hを0~2πの間に収める
        if(h < 0) h += 2 * Math.PI;
        else if(h > 2 * Math.PI) h -= 2 * Math.PI;
        h = h / (2 * Math.PI) * 360;

        hsvS[i / 4][0] = Math.round(h);
        hsvS[i / 4][1] = Math.round(s);
        hsvS[i / 4][2] = Math.round(v);
    }        
    return hsvS;
}

// グレースケール化
function rgb2grey(img_data, imagecolors) {
    const width = img_data.width;
    const height = img_data.height;
    const data = img_data.data;
    
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var index = (x + y * width) * 4;
            // 標準的な輝度変換式を使用
            var grey = Math.round(0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]);
            
            // RGBの全チャンネルに同じ値を設定
            for (var i = 0; i < 3; i++) {
                imagecolors[index + i] = grey;
            }
            imagecolors[index + 3] = 255; // アルファチャンネルは不透明に
        }
    }
    return imagecolors;
}

async function filesave(str,filecount,folder){
    let blob = new Blob([str],{type:"text/plain"});
    folder.file("imagefill" + filecount + ".mcfunction",str);
}

function init_zip(){
    //zipファイル
    let zip = new JSZip();
    let folder1 = zip.folder("img2MC");
    let folder2 = folder1.folder("data");
    let pack_file = folder1.file('pack.mcmeta','{\n"pack": {\n"pack_format": 1,\n"description": "datapack"\n}\n}');
    let folder3 = folder2.folder("cheese");
    let folder4 = folder3.folder("functions");
    return [zip,folder4];
}

async function zipDL(zip){
    let img_element = document.getElementById('inputImage');

    zip.generateAsync({type:"blob"})
    .then(function(content) {
    saveAs(content, "img2MC.zip");
    console.log(img_element.name);
    });
}