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
    //document.getElementById('test_canvas').addEventListener('click', processImageData);
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
    
    //画像が選択されてるか確認
    if (!img_data) alert("画像が選択されてないよ！");
    try{
        let zip = init_zip();

        //左上のブロック設置座標
        let origin_xyz = [0,0,0];

        let processed_data = cv.getContext('2d').createImageData(img_data.width, img_data.height);
        //色格納
        let imagecolors = [...Array(img_data.width * img_data.height * 4)].map(k=>0);
        //チェックボックス確認
        let checkbox = checkboxConfirm();
        if(num == 0){
            //誤差拡散法
            processed_data = greyErrorDiffusion(img_data,imagecolors,processed_data,checkbox,origin_xyz,zip[0],zip[1]);
        }
        else if(num == 1){
            processed_data = colorErrorDiffusion(img_data,processed_data,checkbox,origin_xyz,zip[0],zip[1]);
        }
        else if(num == 2){
            processed_data = colorReplaceCiede2000(img_data,processed_data,checkbox,origin_xyz,zip[0],zip[1]);
        }
        cv.getContext('2d').putImageData(processed_data, 0, 0);
    }catch(e){}
}

/*
誤差拡散法（グレースケールver完成）
*/
function greyErrorDiffusion(img_data,imagecolors,processed_data,checkbox,origin_xyz,zip,folder){

    //グレースケール化
    imagecolors = rgb2grey(img_data,imagecolors);

    var error;
    for (var y = 0;y < img_data.height - 1;y++) {
        for (var x = 0;x < img_data.width - 1;x++) {
            var mid_set_color = new Array(256);
            var error_add = new Array(256);
            for(var i = 0;i < 128;i++){
                mid_set_color [i] = 0;
                error_add[i] = 0;
            }
            for(var i = 128;i <= 255;i++){
                mid_set_color [i] = 255;
                error_add[i] = 255;
            }

            var index = (x + y * img_data.width)*4;
            //誤差計算
            error = imagecolors[index] - error_add[Math.round(imagecolors[index])];
            for(var i = 0;i < 3; i++){
                imagecolors[index + i] = mid_set_color[Math.round(imagecolors[index + i])];             
            }

            //拡散(7 5 3 1 を試したがノイズが大きい)
            for(var i = 0;i < 3; i++){
                //右
                if(x < img_data.width - 1){
                    imagecolors[((x + 1) + y * img_data.width)*4 + i] += (error * 5) / 16 | 0;                        
                }
                //左下
                if(x > 0){
                    imagecolors[((x - 1) + (y + 1) * img_data.width)*4 + i] += (error * 2.8) / 16 | 0;
                }
                //下
                if(i < img_data.height -1){
                    imagecolors[(x + (y + 1) * img_data.width)*4 + i] += (error * 5) / 16 | 0;
                }
                //右下
                if(x < img_data.width - 1 && y > img_data.height - 1){
                    imagecolors[((x + 1) + (y + 1) * img_data.width)*4 + i] += (error * 3.2) / 16 | 0;
                }
            }
        }
    }
    //画像化
    for (var i = 0;i < img_data.data.length;i++) {
        processed_data.data[i] = imagecolors[i];
    }
    
    //マイクラドット絵コマンド書き込み(ゲーム内のコマンド/functionで実行)
    let tmp_num;
    let count = 0;
    let filecount = 0;
    var functionStr = '';
    for (var y = 0;y < img_data.height;y++) {
        for (var x = 0;x < img_data.width;x++) {
            count++;
            var index = (x + y * img_data.width)*4;
            
            tmp_num = 0;
            for(var c = 1;c < img_data.width;c++) {
                if(imagecolors[((x + c) + y * img_data.width)*4] == imagecolors[index] && (x + c) <= img_data.width) {
                    tmp_num += 1;
                }
                else break;
            }

            if(imagecolors[index] == 0){
                functionStr += "fill " + (x + origin_xyz[0]) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " " + (x + origin_xyz[0] + c) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " minecraft:black_wool\n";
            }
            else if(imagecolors[index] == 255){
                functionStr += "fill " + (x + origin_xyz[0]) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " " + (x + origin_xyz[0] + c) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " minecraft:white_wool\n";
            }
            x += tmp_num;
            if(count >= 10000){
                filecount++;
                filesave(functionStr,filecount,folder);
                functionStr = "";
                count = 0;
            }
        }
    }
    filesave(functionStr,filecount,folder);
    zipDL(zip);

    return processed_data;
}

function colorReplaceCiede2000(img_data,processed_data,checkbox,origin_xyz,zip,folder){

    const width = img_data.width;
    const height = img_data.height;    
    const color_csv = loadCSVFile2(checkbox);//csvファイル
    const lab_array_size = color_csv[2].length;

    let output_data = [...img_data.data];//画像の色コピー

    //色比較
    for(var y = 0;y < height;y++){
        for(var x = 0;x < width;x++){
            const index = (x + y * width) * 4;
            
            let distance = [...Array(lab_array_size)].map(k=>100.0);
            //比較
            for(var i = 0;i < lab_array_size; i++){
                if(output_data[index + 3] > 0){
                    let lab = rgb2lab([output_data[index],output_data[index + 1],output_data[index + 2]]);
                    distance[i] = ciede2000(lab[0],lab[1],lab[2],color_csv[2][i][0],color_csv[2][i][1],color_csv[2][i][2]);
                }
            }

            
            let tmp_comp_num = distance[0];
            let comp_num = 0;
            for(var i = 1;i < lab_array_size;i++){
                if(tmp_comp_num > distance[i]){
                    tmp_comp_num = distance[i];
                    comp_num = i;
                }
            }

            //一番近い色に置き換え
            for(var i = 0;i < 3; i++){
                output_data[index + i] = color_csv[1][comp_num][i];
            }
        }
    }

    //画像化 
    for (var i = 0;i < img_data.data.length;i++) { 
        processed_data.data[i] = output_data[i];
    }
    return processed_data;
}

function colorErrorDiffusion(img_data,processed_data,checkbox,origin_xyz,zip,folder){

    const width = img_data.width;
    const height = img_data.height;    
    const color_csv = loadCSVFile2(checkbox);//csvファイル
    const lab_array_size = color_csv[2].length;

    let output_data = [...img_data.data];//画像の色コピー

    //色比較
    for(var y = 0;y < height;y++){
        for(var x = 0;x < width;x++){
            const index = (x + y * width) * 4;
            
            let distance = [...Array(lab_array_size)].map(k=>100.0);
            //比較
            for(var i = 0;i < lab_array_size; i++){
                if(output_data[index + 3] > 0){
                    let lab = rgb2lab([output_data[index],output_data[index + 1],output_data[index + 2]]);
                    distance[i] = ciede2000(lab[0],lab[1],lab[2],color_csv[2][i][0],color_csv[2][i][1],color_csv[2][i][2]);
                }
            }

            
            let tmp_comp_num = distance[0];
            let comp_num = 0;
            for(var i = 1;i < lab_array_size;i++){
                if(tmp_comp_num > distance[i]){
                    tmp_comp_num = distance[i];
                    comp_num = i;
                }
            }

            //一番近い色に置き換え
            let error = [...Array(3)].map(k => 0);
            for(var i = 0;i < 3; i++){
                //誤差（rgbそれぞれで算出）
                error[i] = output_data[index + i] - color_csv[1][comp_num][i];
                output_data[index + i] = color_csv[1][comp_num][i];
            }

            //誤差拡散
            let x_i = x + 1;
            let y_i = y + 1;
            let indexR = (x_i + y * width)*4;
            let indexUL = ((x - 1) + y_i * width)*4;
            let indexU = (x + y_i * width)*4;
            let indexUR = (x_i + y_i * width)*4;
            let tmp_array = [...Array(3)].map(k => 0);

            //右
            if(x < width - 1){
                tmp_array = normalizeOutput2([output_data[indexR],output_data[indexR + 1],output_data[indexR + 2]],[...error].map(k => k * 5 / 16));  
                for(var i = 0;i < 3;i++){
                    output_data[indexR + i] = tmp_array[i];
                }
            }
            //左下
            if(x > 0){
                tmp_array = normalizeOutput2([output_data[indexUL],output_data[indexUL + 1],output_data[indexUL + 2]],[...error].map(k => k * 2.8 / 16));
                for(var i = 0;i < 3;i++){
                    output_data[indexUL + i] = tmp_array[i];
                }
            }
            //下
            if(y < height -1){
                tmp_array = normalizeOutput2([output_data[indexU],output_data[indexU + 1],output_data[indexU + 2]],[...error].map(k => k * 5 / 16));
                for(var i = 0;i < 3;i++){
                    output_data[indexU + i] = tmp_array[i];
                }
            }
            //右下
            if(x < width - 1 && y > height - 1){
                tmp_array = normalizeOutput2([output_data[indexUR],output_data[indexUR + 1],output_data[indexUR + 2]],[...error].map(k => k * 3.2 / 16));
                for(var i = 0;i < 3;i++){
                    output_data[indexUR + i] = tmp_array[i];
                }
            }
            
            /*
            for(var i = 0;i < 3; i++){
                //右
                if(x < width - 1){
                    output_data[indexR + i] = normalizeOutput(output_data[indexR + i] + (error[i] * 5) / 16);  
                }
                //左下
                if(x > 0){
                    output_data[indexUL + i] = normalizeOutput(output_data[indexUL + i] + (error[i] * 2.8) / 16);
                }
                //下
                if(y < height -1){
                    output_data[indexU + i] = normalizeOutput(output_data[indexU + i] + (error[i] * 5) / 16);
                }
                //右下
                if(x < width - 1 && y > height - 1){
                    output_data[indexUR + i] = normalizeOutput(output_data[indexUR + i] + (error[i] * 3.2) / 16);
                }
            }
            */
        }
    }

    //画像化 
    for (var i = 0;i < img_data.data.length;i++) { 
        processed_data.data[i] = output_data[i];
    }
    return processed_data;
}
/*
アウトプットカラー正規化
*/
function normalizeOutput(color){
    if(color > 255) color = 255;
    else if(color < 0) color = 0;
    return color;
}
/*
アウトプットカラー正規化
*/
function normalizeOutput2(color,error){
    let dis_error = [...Array(3)].map(k => 0);
    for(var i = 0;i < 3;i++){
        color[i] += error[i];
        if(color[i] > 255) {
            dis_error = color[i] - 255;
            console.log(color);
            color = Array.from([...color].map(k => k - (dis_error / 2)));
            console.log(color);
            color[i] = 255;
        }
        else if(color[i] < 0) {
            dis_error = color[i];
            color = Array.from([...color].map(k => k - (dis_error / 2)));
            color[i] = 0;
        }
    }

    return color;
}
/*
チェックボックス確認
*/
function checkboxConfirm(){
    return [
        document.getElementById("blockType1").checked,
        document.getElementById("blockType2").checked,
        document.getElementById("blockType3").checked
    ];
}

/*
minAngle計算
*/
function minAngleCalculate(hsvS,scope,angle){
    let min_angle;
    min_angle = hsvS - (scope / 2);
    if(min_angle < 0) min_angle += angle;
    return min_angle;
}

/*
maxAngle計算
*/
function maxAngleCalculate(hsvS,scope,angle){
    let max_angle;
    max_angle = hsvS + (scope / 2);
    if(max_angle >= 360) max_angle -= angle;
    return max_angle;
}
/*
0 ~ 359に正規化
*/
function angleSet(num,angle){
    if(num >= 360) num -= angle;
    if(num < 0) num += angle;
    return num;
}
/*
rgbからlabに変換(配列初期化)
*/
function init_rgb2lab(array,array_size){
    let labS = [...Array(array_size)].map(k=>[...Array(3)].map(k=>-1));
    for(var i = 0;i < array_size * 4;i += 4){
        labS[i / 4] = rgb2lab([array[i],array[i + 1],array[i + 2]]);
    }
    return labS;
}

/*
rgbからlabに変換
*/
function rgb2lab(rgb) {
    r = rgb[0];
    g = rgb[1];
    b = rgb[2];

    r = r > 0.04045 ? Math.pow((r / 269.025 + 0.05213), 2.4) : (r / 12.92);
    g = g > 0.04045 ? Math.pow((g / 269.025 + 0.05213), 2.4) : (g / 12.92);
    b = b > 0.04045 ? Math.pow((b / 269.025 + 0.05213), 2.4) : (b / 12.92);

    var x = (r * 0.4338906) + (g * 0.3762349) + (b * 0.1899060);
    var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
    var z = (r * 0.0177254) + (g * 0.1094753) + (b * 0.8729554);

    x = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + 0.13793103;
    y = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + 0.13793103;
    z = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + 0.13793103;

    var L = (116 * y) - 16;
    var a = 500 * (x - y);
    var b = 200 * (y - z);

    //場合分けなしver(cidedと合わせて使うと精度がよくない)
    /*
    var L = 100 * y ** (1/2.44);
    var a = 435.8 * Math.pow(x,0.40984) - Math.pow(y,0.40984);
    var b = 173.6 * Math.pow(y,0.40984) - Math.pow(z,0.40984);
    */
    return [L, a, b];
}

/*
rgbからhsv変換
*/
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

/*
グレースケール化
*/
function rgb2grey(img_data,imagecolors){
    for (var y = 1;y < img_data.height;y++) {
        for (var x = 1;x < img_data.width;x++) {
            var index = (x + y * img_data.width)*4;
            rgb_grey = 0.2126 * img_data.data[index] + 0.7152 * img_data.data[index + 1] + 0.0722 * img_data.data[index + 2];    
            //rgb_grey = (img_data.data[index] + img_data.data[index + 1] + img_data.data[index + 2])/3;
            for(i = 0;i < 3;i++){
                imagecolors[index + i] = rgb_grey;
            }
            imagecolors[index + 3] = 255;
        }
    }
    return imagecolors;
}

/*
色格納
*/
function rgbInArray(img_data){
    let color_data = [];//[...Array(img_data.width * img_data.height * 4)].map(k=>0);
    for(var i = 0;i < img_data.width * img_data.height * 4;i += 4){
        for(var j = 0;j < 3;j = j + 1){
            color_data[i + j] = img_data.data[i + j];
        }
        color_data[i + 3] = 255;
    }
    return color_data;
}

/*
ciede距離算出
*/
function ciede2000(L1,a1,b1, L2,a2,b2) {
    //http://en.wikipedia.org/wiki/Color_difference#CIEDE2000
    var pow7 = function(num) {return num*num*num*num*num*num*num};

    const c_7_coe = 6103515625;
    const degree = 57.2957732;
    const angle = 360;
    const half_angle = 180;
    var C1 = Math.sqrt(a1*a1 + b1*b1);
    var C2 = Math.sqrt(a2*a2 + b2*b2);
    var pow_c_7 = pow7((C1 + C2) / 2);
    var tmp_math = 0.5 * (1 - Math.sqrt(pow_c_7 / ( pow_c_7 + c_7_coe)));
    var ap1 = a1 + a1 * tmp_math;
    var ap2 = a2 + a2 * tmp_math;
    var Cp1 = Math.sqrt(ap1*ap1 + b1*b1);
    var Cp2 = Math.sqrt(ap2*ap2 + b2*b2);
    var Cp_ = Cp1 + Cp2;

    var hp1;
    if (b1 == 0 && ap1 == 0) {
        hp1 = 0;
    } else {
        hp1 = degree * Math.atan2(b1, ap1);
        if (hp1 < 0) {hp1 = hp1 + angle;}
    }
    var hp2;
    if (b2 == 0 && ap2 == 0) {
        hp2 = 0;
    } else {
        hp2 = degree * Math.atan2(b2, ap2);
        if (hp2 < 0) {hp2 = hp2 + angle;}
    }

    var dis_hp1_hp2 = hp2 - hp1;
    var deltahp;
    if (C1 == 0 || C2 == 0) {
        deltahp = 0;
    } else if (Math.abs(dis_hp1_hp2) <= half_angle) {
        deltahp = dis_hp1_hp2;
    } else if (hp2 <= hp1) {
        deltahp = dis_hp1_hp2 + angle;
    } else {
        deltahp = dis_hp1_hp2 - angle;
    }

    var Hp_;
    if (Math.abs(dis_hp1_hp2) > half_angle) {
        Hp_ =  (hp1 + hp2 + angle) * 0.5;
    } else {
        Hp_ = (hp1 + hp2) * 0.5;
    };

    var T = 1 -
        0.17 * Math.cos(0.0174533 * (Hp_ - 30)) +
        0.24 * Math.cos(0.0349066 * Hp_) +
        0.32 * Math.cos(0.0523599 * Hp_ + 0.1047198) -
        0.20 * Math.cos(0.0698132 * Hp_ - 1.0995579);

    var tmp_50 = ((L1 + L2) * 0.5) - 50;
    var pow_tmp_50 = tmp_50 * tmp_50;

    var cp_pow7 = pow7(Cp_ * 0.5);
    var hp_25 = Hp_ * 0.04 - 11 ;

    var ddLp = (L2 - L1) / (1 + ((0.015 * pow_tmp_50) / Math.sqrt(20 + pow_tmp_50)));
    var ddCp = (Cp2 - Cp1) / (1 + 0.0225 * Cp_);
    var ddHp = Math.sqrt(Cp1 * Cp2) * Math.sin(0.00872665 * deltahp) / (0.5 + 0.00375 * Cp_ * T);
    return Math.sqrt(
        ddLp*ddLp + ddCp*ddCp + ddHp*ddHp + 
        (-2) * 
        Math.sqrt(cp_pow7 / (cp_pow7 + c_7_coe)) * 
        Math.sin(1.047198 * Math.exp(-hp_25*hp_25)) * ddCp * ddHp);
}

/*
excelファイル読み込み
csv_array[i][0] = {h,s,v}
csv_array[i][1] = {r,g,b}
*/
function loadCSVFile(){
    let csv = new XMLHttpRequest();
    let array = [...Array(3)].map(k=>[...Array(360)].map(k=>[...Array(3)].map(k=>-1)));
    csv.open("get", "BlocksColor.csv",false);
    csv.send(null);

    console.log("ブロック色のファイルは読み込めました。");

    let str = csv.responseText;
    let tmp_array = str.split("\n");
    for(var i = 1;i < tmp_array.length - 1;i++){
        let hsv_array = Array.from(tmp_array[i].split(',').slice(7,10), str => parseInt(str, 10));
        let rgb_array = Array.from(tmp_array[i].split(',').slice(1,4), str => parseInt(str, 10));
        array[0][hsv_array[0]] = hsv_array;
        //array[0][hsv_array[0]] = [parseInt(hsv_array[0]),parseInt(hsv_array[1]),parseInt(hsv_array[2])];
        array[1][hsv_array[0]] = rgb_array;
        //array[1][rgb_array[0]] = [parseInt(rgb_array[0]),parseInt(rgb_array[1]),parseInt(rgb_array[2])];
        array[2][hsv_array[0]] = rgb2lab(rgb_array).map(x => Math.round(x));
    }
    
    return array;
}

/*
excelファイル読み込み
csv_array[i][0] = {h,s,v}
csv_array[i][1] = {r,g,b}
*/
function loadCSVFile2(checkbox){
    let csv = new XMLHttpRequest();
    csv.open("get", "BlocksColor.csv",false);
    csv.send(null);

    console.log("ブロック色のファイルは読み込めました。");

    let str = csv.responseText;
    let tmp_array = str.split("\n");
    let array_size = tmp_array.length;
    let array = [...Array(3)].map(k=>[...Array(array_size - 2)].map(k=>[...Array(3)].map(k=>-1)));
    if(checkbox[0]){

    }
    for(var i = 1;i < array_size - 1;i++){
        let hsv_array = Array.from(tmp_array[i].split(',').slice(7,10), str => parseInt(str, 10));
        let rgb_array = Array.from(tmp_array[i].split(',').slice(1,4), str => parseInt(str, 10));
        
        let index = i - 1;
        array[0][index] = hsv_array;
        array[1][index] = rgb_array;
        array[2][index] = rgb2lab(rgb_array);
    }
    
    return array;
}

function loadCSVFile3(checkbox){
    let csv = new XMLHttpRequest();
    csv.open("get", "BlocksColor.csv",false);
    csv.send(null);

    console.log("ブロック色のファイルは読み込めました。");

    let str = csv.responseText;
    let tmp_array = str.split("\n");
    let array_size = tmp_array.length;
    let array = [...Array(3)].map(k=>[...Array(array_size - 2)].map(k=>[...Array(3)].map(k=>-1)));
    if(checkbox[0]){

    }
    for(var i = 1;i < array_size - 1;i++){
        let hsv_array = Array.from(tmp_array[i].split(',').slice(7,10), str => parseInt(str, 10));
        let rgb_array = Array.from(tmp_array[i].split(',').slice(1,4), str => parseInt(str, 10));
        
        let index = i - 1;
        array[0][index] = hsv_array;
        array[1][index] = rgb_array;
        array[2][index] = rgb2lab(rgb_array);
    }
    
    return array;
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
