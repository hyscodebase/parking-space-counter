# 티처블 머신 프로젝트 열기

## 어떤 파일을 선택하나요?

| 파일 | 용도 |
| --- | --- |
| `training/parking-v2-training-source.tm` | 티처블 머신에서 학습 사진과 설정을 다시 여는 프로젝트 |
| `dist/models/parking/model.json`, `metadata.json`, `weights.bin` | 완성된 v2 추론 모델. 웹앱의 기본 모델로 포함 |
| `dist/parking-teachable-machine-model.zip` | 완성 모델 파일을 다운로드하기 위한 ZIP |
| `artifacts/dataset-v2.zip` | 재학습·평가 도구에 사용하는 데이터 묶음 |

티처블 머신의 **프로젝트 열기**에서는 `.tm` 파일을 선택합니다. 이 파일은 압축을 해제하지 않습니다.

## 웹에서 확인하는 순서

1. PC의 Chrome 또는 Safari에서 https://teachablemachine.withgoogle.com/train/image 를 엽니다.
2. 메뉴에서 **Open project from file(파일에서 프로젝트 열기)**를 선택합니다.
3. 이 저장소의 `training/parking-v2-training-source.tm`을 선택합니다.
4. **빈자리**와 **사용 중** 클래스가 각각228장인지 확인합니다.
5. 고급 학습 설정을 확인합니다. Epochs50, Batch size16, Learning rate0.001입니다.
6. **Train Model(모델 학습)**을 누르고 완료될 때까지 탭을 유지합니다.
7. 미리보기에서 웹캠 대신 파일 업로드를 선택하고 **주차칸 한 칸을 잘라낸 사진**으로 확인합니다.
8. 웹에서 학습한 모델을 저장하려면 **Export Model → TensorFlow.js → Download**를 사용합니다. 학습 자료 프로젝트도 보관하려면 메뉴의 **Download project as file**을 사용합니다.

이 모델은 주차칸 한 칸을 학습 단위로 사용합니다. 사이트에서는 사용자가 지정한1~100개 주차칸을 각각 잘라 분류하고, 사용 중인 칸의 수를 차량 수로 합산합니다. 티처블 머신 미리보기에서는 주차칸 한 칸을 잘라낸 사진으로 빈자리·사용 중 판정을 확인합니다.

## 학습 전 프로젝트와 완성 모델

`.tm`에는224×224 JPG456장과 학습 설정이 들어 있습니다. 빈자리228장과 사용 중228장이며, 각 클래스는 맑음100장·흐림100장·비28장입니다. 완성된 가중치는 이 프로젝트 파일에 들어 있지 않으므로 미리보기 전에 웹에서 학습해야 합니다.

기존 v2 완성 모델은 공식 `@teachablemachine/image@0.8.3` 라이브러리를 Node CPU에서 실행해 학습했습니다. 티처블 머신 웹 UI에서 학습 완료한 파일로 표현하지 않습니다. 웹에서 다시 학습한 모델은 실행 환경과 무작위 분할 차이 때문에 기존 모델과 가중치·예측이 달라질 수 있습니다. README의 평가 수치는 저장소에 포함된 기존 v2 완성 모델 기준입니다.

`.tm`의 ZIP 구조·이미지 수·손상 여부는 검사했습니다. 이 파일을 현재 티처블 머신 웹 UI에서 직접 열고 학습을 끝내는 검증은 아직 수행하지 않았습니다.

## 파일을 열 수 없을 때

- 전체 GitHub 프로젝트 ZIP이 아니라 `training/parking-v2-training-source.tm`을 선택했는지 확인합니다.
- 프로젝트 파일을 이미지 클래스의 **Upload**로 넣지 말고 **Open project from file**로 엽니다.
- 다운로드 중 파일이 잘리지 않았는지 확인합니다. 원본 크기는3,633,652바이트입니다.
- 모바일에서 진행이 어렵다면 PC의 Chrome 또는 Safari로 확인합니다.

공식 페이지: https://teachablemachine.withgoogle.com/ · https://teachablemachine.withgoogle.com/faq
