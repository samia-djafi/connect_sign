# ConnectSign AI Model Artifacts

## Provenance and Specifications

- **Model Type**: Linear Support Vector Classifier (`LinearSVC`, $C=0.5$, $L_2$ penalty, `dual=False`) with `StandardScaler`.
- **Confidence Mechanism**: Softmax normalization over raw signed margin decision scores (`LinearSVC.decision_function`). Uncalibrated (not Platt-scaled); outputs below `UNCERTAINTY_THRESHOLD = 0.12` trigger automatic rejection to avoid hallucinating signs.
- **Target Domain**: Algerian Sign Language (LSA / لغة الإشارة الجزائرية) — Frontline Healthcare & Medical Communication.
- **Dataset Source**: VDzSL Benchmark (Zenodo DOI: `10.5281/zenodo.18209839`, PMC12925472).
- **Training Population**: 4 Avatars (`signer0`..`signer3`) across 5 viewpoints (`cam0`..`cam4`); 448 training samples, 96 holdout test samples.
- **Feature Representation**: Spatio-temporal coordinate trajectories across 16 frames combining 21 hand keypoints (left & right) and 7 upper-body pose joints, normalized relative to torso center and shoulder width, plus temporal dynamics statistics ($D = 3{,}453$ features per window).
- **Active Output Classes**: 32 verified isolated sign classes (labels: `1`, `2`, `3`, `أذن`, `ألم`, `إبرة`, `الآن`, `الليل`, `بشرة`, `جسم`, `حرارة`, `حسنا`, `خطر`, `رأس`, `سكر`, `شكرا`, `صباح`, `طبيب أسنان`, `طعام`, `قلب`, `كحول`, `كل يوم`, `كم`, `لا`, `ماء`, `مال`, `مريض`, `من فضلك`, `نصف`, `نعم`, `يد`, `يساعد`).
- **Evaluation Metrics (Holdout Test Set)**:
  - **Test Accuracy**: 67.71%
  - **Macro F1 Score**: 66.16%
  - **Mean Inference Latency**: ~1.15 ms on CPU

## Artifact Files

| File | Size | Role |
|---|---|---|
| `best_model.joblib` | ~833 KB | Serialized scikit-learn classifier pipeline (`LinearSVC` + `StandardScaler`) |
| `config.json` | ~1 KB | Feature dimension, hyperparameter metadata, evaluation scores, and target class list |
| `mvp_classes.json` | ~7.8 KB | Numerical ID $\leftrightarrow$ Arabic label mapping, slugs, and class metadata |
| `hand_landmarker.task` | ~7.8 MB | MediaPipe Hand Landmarker model (21 keypoints per hand) |
| `pose_landmarker_lite.task` | ~5.8 MB | MediaPipe Pose Landmarker model (upper body skeleton) |

## Loading Protocol & Runtime Execution

Artifacts are loaded once into memory at application startup by `app.services.inference.InferenceService`. Feature scaling and linear classification execute entirely on CPU ($< 2$ ms inference time per feature vector), enabling local-first deployment without GPU hardware.
