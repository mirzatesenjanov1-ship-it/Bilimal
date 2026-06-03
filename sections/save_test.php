<?php
// Маалымат JSON түрүндө келерин билдирүү
header("Content-Type: application/json; charset=UTF-8");

// 1. Маалымат базасына туташуу (Өзүңүздүн маалыматтарыңызды жазыңыз)
$servername = "localhost";
$username = "root";       // Базанын логини
$password = "";           // Базанын сырсөзү (паролу)
$dbname = "bilimal_db";   // Базанын аталышы

try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Базага туташуу катасы: " . $e->getMessage()]);
    exit();
}

// 2. JavaScript'тен келген JSON маалыматты кабыл алуу
$data = json_decode(file_get_contents("php://input"), true);

// Маалыматтын же суроолордун жоктугун текшерүү
if (empty($data) || empty($data['questions'])) {
    echo json_encode(["status" => "error", "message" => "Маалымат же суроолор келген жок."]);
    exit();
}

// 3. Маалыматтарды базага сактоо цикли
try {
    // Жалпы тестти идентификациялоо үчүн уникалдуу код (мисалы TEST-4552)
    $test_code = "TEST-" . rand(1000, 9999); 
    
    // JS коддон келген теманы жана суроолор массивин бөлүп алабыз
    $test_title = isset($data['title']) ? $data['title'] : 'Белгисиз тема';
    $questions = $data['questions'];
    
    // Ар бир суроо блогун айланып чыгып, базага жазуу
    foreach ($questions as $block) {
        $type = $block['type'];
        
        // Маалыматты JSON форматында бойдон бир катарга сактоо
        $content_json = json_encode($block, JSON_UNESCAPED_UNICODE);
        
        // ЭСКЕРТҮҮ: Таблицага "title" (тема) деген колонка кошулду
        $sql = "INSERT INTO test_questions (test_code, title, question_type, content) VALUES (:test_code, :title, :type, :content)";
        $stmt = $conn->prepare($sql);
        
        $stmt->bindParam(':test_code', $test_code);
        $stmt->bindParam(':title', $test_title);
        $stmt->bindParam(':type', $type);
        $stmt->bindParam(':content', $content_json);
        
        $stmt->execute();
    }
    
    // Ийгиликтүү болсо жооп кайтаруу
    echo json_encode(["status" => "success", "message" => "Тест ийгиликтүү сакталды", "test_code" => $test_code]);

} catch(Exception $e) {
    echo json_encode(["status" => "error", "message" => "Сактоодо ката кетти: " . $e->getMessage()]);
}

$conn = null;
?>
