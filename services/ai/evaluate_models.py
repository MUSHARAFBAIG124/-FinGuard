"""
AI Model Evaluation & Accuracy Audit
Comprehensive evaluation of credit risk models
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Scikit-learn imports
from sklearn.model_selection import train_test_split, cross_val_score, cross_validate
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report, roc_curve, auc
)
from sklearn.preprocessing import StandardScaler

# XGBoost import
try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("XGBoost not available, will skip XGBoost evaluation")

# SHAP import
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("SHAP not available, will skip SHAP analysis")

import joblib
import matplotlib.pyplot as plt
import seaborn as sns


# Configuration
DATA_PATH = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\Dataset\\german.data-numeric"
OUTPUT_DIR = Path("C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\evaluation_results")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class ModelEvaluator:
    """Comprehensive model evaluation framework."""
    
    def __init__(self, data_path: str):
        """Initialize evaluator."""
        self.data_path = data_path
        self.X = None
        self.y = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.results = {}
        self.scaler = StandardScaler()
        
    def load_data(self):
        """Load and prepare data."""
        print("\n[STEP 1] Loading Data")
        print("-" * 60)
        
        df = pd.read_csv(self.data_path, sep='\s+', header=None)
        self.X = df.iloc[:, :-1].values
        self.y = df.iloc[:, -1].map({1: 1, 2: 0}).values
        
        print(f"Total records: {len(df)}")
        print(f"Features: {self.X.shape[1]}")
        
        # Class distribution
        unique, counts = np.unique(self.y, return_counts=True)
        print(f"\nClass distribution:")
        print(f"  Good Credit (1): {counts[1]}")
        print(f"  Bad Credit (0): {counts[0]}")
        print(f"  Imbalance ratio: {counts[1]/counts[0]:.2f}:1")
        
        # Train/test split
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.X, self.y, test_size=0.2, random_state=42, stratify=self.y
        )
        
        print(f"\nTrain/Test split (80/20):")
        print(f"  Training set: {len(self.X_train)}")
        print(f"  Test set: {len(self.X_test)}")
        
        self.results['dataset'] = {
            'total_records': len(df),
            'features': self.X.shape[1],
            'training_records': len(self.X_train),
            'test_records': len(self.X_test),
            'class_distribution': {
                'good_credit': int(counts[1]),
                'bad_credit': int(counts[0]),
                'imbalance_ratio': float(counts[1]/counts[0])
            }
        }
        
    def train_logistic_regression(self):
        """Train Logistic Regression model."""
        print("\n Training Logistic Regression")
        print("-" * 60)
        
        X_train_scaled = self.scaler.fit_transform(self.X_train)
        X_test_scaled = self.scaler.transform(self.X_test)
        
        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X_train_scaled, self.y_train)
        
        y_pred = model.predict(X_test_scaled)
        y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        y_pred_train = model.predict(X_train_scaled)
        
        metrics = self._compute_metrics(
            'Logistic Regression',
            y_pred, y_pred_proba, model,
            X_test_scaled, y_test_scaled=True,
            train_score=accuracy_score(self.y_train, y_pred_train)
        )
        
        self.results['logistic_regression'] = metrics
        return model, X_train_scaled, X_test_scaled
        
    def train_random_forest(self):
        """Train Random Forest model."""
        print("\n Training Random Forest")
        print("-" * 60)
        
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1
        )
        model.fit(self.X_train, self.y_train)
        
        y_pred = model.predict(self.X_test)
        y_pred_proba = model.predict_proba(self.X_test)[:, 1]
        y_pred_train = model.predict(self.X_train)
        
        metrics = self._compute_metrics(
            'Random Forest',
            y_pred, y_pred_proba, model,
            self.X_test,
            train_score=accuracy_score(self.y_train, y_pred_train)
        )
        
        self.results['random_forest'] = metrics
        
        # Feature importance
        feature_names = [f"Feature_{i+1}" for i in range(self.X.shape[1])]
        importances = model.feature_importances_
        feature_importance = sorted(
            zip(feature_names, importances),
            key=lambda x: x[1],
            reverse=True
        )
        
        self.results['random_forest']['feature_importance'] = [
            {'name': name, 'importance': float(imp)}
            for name, imp in feature_importance
        ]
        
        print(f"\nTop 10 Features:")
        for i, (name, imp) in enumerate(feature_importance[:10], 1):
            print(f"  {i:2d}. {name}: {imp:.4f}")
        
        return model
        
    def train_xgboost(self):
        """Train XGBoost model if available."""
        if not XGBOOST_AVAILABLE:
            print("\n  XGBoost not available, skipping...")
            return None
            
        print("\n Training XGBoost")
        print("-" * 60)
        
        model = XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            eval_metric='logloss',
            verbosity=0
        )
        model.fit(self.X_train, self.y_train)
        
        y_pred = model.predict(self.X_test)
        y_pred_proba = model.predict_proba(self.X_test)[:, 1]
        y_pred_train = model.predict(self.X_train)
        
        metrics = self._compute_metrics(
            'XGBoost',
            y_pred, y_pred_proba, model,
            self.X_test,
            train_score=accuracy_score(self.y_train, y_pred_train)
        )
        
        self.results['xgboost'] = metrics
        return model
        
    def _compute_metrics(self, model_name, y_pred, y_pred_proba, model, X_test, y_test_scaled=False, train_score=0.0):
        """Compute comprehensive metrics."""
        y_test = self.y_test
        
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, zero_division=0)
        recall = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        roc_auc = roc_auc_score(y_test, y_pred_proba)
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = cm.ravel()
        
        # Overfitting analysis
        overfitting_gap = (train_score - accuracy) * 100
        
        print(f"{model_name}:")
        print(f"  Accuracy:  {accuracy:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        print(f"  ROC AUC:   {roc_auc:.4f}")
        print(f"  Train Accuracy: {train_score:.4f}")
        print(f"  Overfitting Gap: {overfitting_gap:.2f}%")
        
        return {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1': float(f1),
            'roc_auc': float(roc_auc),
            'train_accuracy': float(train_score),
            'overfitting_gap': float(overfitting_gap),
            'confusion_matrix': {
                'true_negatives': int(tn),
                'false_positives': int(fp),
                'false_negatives': int(fn),
                'true_positives': int(tp)
            },
            'model': model
        }
        
    def cross_validate_models(self):
        """Perform 5-fold cross validation."""
        print("\n STEP 2: Cross Validation (5-Fold)")
        print("-" * 60)
        
        models = {
            'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
            'Random Forest': RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42)
        }
        
        if XGBOOST_AVAILABLE:
            models['XGBoost'] = XGBClassifier(n_estimators=100, max_depth=6, random_state=42, verbosity=0)
        
        cv_results = {}
        
        for name, model in models.items():
            print(f"\n{name}:")
            
            # Handle scaling for Logistic Regression
            if name == 'Logistic Regression':
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(self.X)
                X_train_cv = X_scaled[:len(self.X_train)]
                X_test_cv = X_scaled[len(self.X_train):]
            else:
                X_train_cv = self.X_train
                X_test_cv = self.X_test
            
            # Cross validation
            scores = cross_validate(
                model, self.X_train, self.y_train,
                cv=5,
                scoring=['accuracy', 'f1', 'precision', 'recall', 'roc_auc'],
                return_train_score=True
            )
            
            cv_results[name] = {
                'accuracy_mean': float(scores['test_accuracy'].mean()),
                'accuracy_std': float(scores['test_accuracy'].std()),
                'f1_mean': float(scores['test_f1'].mean()),
                'f1_std': float(scores['test_f1'].std()),
                'precision_mean': float(scores['test_precision'].mean()),
                'recall_mean': float(scores['test_recall'].mean()),
                'roc_auc_mean': float(scores['test_roc_auc'].mean()),
                'train_accuracy_mean': float(scores['train_accuracy'].mean())
            }
            
            print(f"  Accuracy: {cv_results[name]['accuracy_mean']:.4f} (+/- {cv_results[name]['accuracy_std']:.4f})")
            print(f"  F1 Score: {cv_results[name]['f1_mean']:.4f} (+/- {cv_results[name]['f1_std']:.4f})")
            print(f"  ROC AUC:  {cv_results[name]['roc_auc_mean']:.4f}")
        
        self.results['cross_validation'] = cv_results
        
    def generate_report(self):
        """Generate comprehensive evaluation report."""
        print("\n[REPORT] STEP 3: Generating Report")
        print("-" * 60)
        
        # Remove non-serializable model objects
        results_copy = {}
        for key, value in self.results.items():
            if isinstance(value, dict):
                results_copy[key] = {k: v for k, v in value.items() if k != 'model'}
            else:
                results_copy[key] = value
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'evaluation_summary': results_copy
        }
        
        # Save detailed report
        report_path = OUTPUT_DIR / 'evaluation_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"Report saved to: {report_path}")
        
        # Generate text summary
        self._generate_text_summary()
        
    def _generate_text_summary(self):
        """Generate human-readable summary."""
        summary_path = OUTPUT_DIR / 'EVALUATION_SUMMARY.txt'
        
        with open(summary_path, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("AI MODEL EVALUATION & ACCURACY AUDIT\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")
            
            # Dataset summary
            f.write("STEP 1: DATASET ANALYSIS\n")
            f.write("-" * 80 + "\n")
            ds = self.results['dataset']
            f.write(f"Total Records: {ds['total_records']}\n")
            f.write(f"Features: {ds['features']}\n")
            f.write(f"Training Set: {ds['training_records']} (80%)\n")
            f.write(f"Test Set: {ds['test_records']} (20%)\n")
            f.write(f"\nClass Distribution:\n")
            f.write(f"  Good Credit: {ds['class_distribution']['good_credit']}\n")
            f.write(f"  Bad Credit: {ds['class_distribution']['bad_credit']}\n")
            f.write(f"  Imbalance Ratio: {ds['class_distribution']['imbalance_ratio']:.2f}:1\n")
            
            # Model metrics comparison
            f.write("\n" + "=" * 80 + "\n")
            f.write("STEP 2: MODEL PERFORMANCE COMPARISON\n")
            f.write("-" * 80 + "\n")
            
            f.write("\n{:<20} {:<12} {:<12} {:<12} {:<12} {:<12}\n".format(
                "Model", "Accuracy", "Precision", "Recall", "F1 Score", "ROC AUC"
            ))
            f.write("-" * 80 + "\n")
            
            for model_name in ['logistic_regression', 'random_forest', 'xgboost']:
                if model_name in self.results and self.results[model_name]:
                    m = self.results[model_name]
                    f.write("{:<20} {:<12.4f} {:<12.4f} {:<12.4f} {:<12.4f} {:<12.4f}\n".format(
                        model_name.replace('_', ' ').title(),
                        m['accuracy'],
                        m['precision'],
                        m['recall'],
                        m['f1'],
                        m['roc_auc']
                    ))
            
            # Confusion matrices
            f.write("\n" + "=" * 80 + "\n")
            f.write("STEP 3: CONFUSION MATRICES\n")
            f.write("-" * 80 + "\n")
            
            for model_name in ['logistic_regression', 'random_forest', 'xgboost']:
                if model_name in self.results and 'confusion_matrix' in self.results[model_name]:
                    cm = self.results[model_name]['confusion_matrix']
                    f.write(f"\n{model_name.replace('_', ' ').title()}:\n")
                    f.write(f"  True Negatives (TN):  {cm['true_negatives']}\n")
                    f.write(f"  False Positives (FP): {cm['false_positives']}\n")
                    f.write(f"  False Negatives (FN): {cm['false_negatives']}\n")
                    f.write(f"  True Positives (TP):  {cm['true_positives']}\n")
                    f.write(f"\nInterpretation for Loan Approval:\n")
                    f.write(f"  - TN: Correctly rejected bad credit applications\n")
                    f.write(f"  - FP: Incorrectly approved risky applications (RISK)\n")
                    f.write(f"  - FN: Incorrectly rejected good credit applications (LOST REVENUE)\n")
                    f.write(f"  - TP: Correctly approved good credit applications\n")
            
            # Cross validation
            f.write("\n" + "=" * 80 + "\n")
            f.write("STEP 4: CROSS VALIDATION RESULTS (5-FOLD)\n")
            f.write("-" * 80 + "\n")
            
            if 'cross_validation' in self.results:
                for model_name, cv_results in self.results['cross_validation'].items():
                    f.write(f"\n{model_name}:\n")
                    f.write(f"  Accuracy:  {cv_results['accuracy_mean']:.4f} (+/- {cv_results['accuracy_std']:.4f})\n")
                    f.write(f"  F1 Score:  {cv_results['f1_mean']:.4f} (+/- {cv_results['f1_std']:.4f})\n")
                    f.write(f"  Precision: {cv_results['precision_mean']:.4f}\n")
                    f.write(f"  Recall:    {cv_results['recall_mean']:.4f}\n")
                    f.write(f"  ROC AUC:   {cv_results['roc_auc_mean']:.4f}\n")
            
            # Feature importance
            f.write("\n" + "=" * 80 + "\n")
            f.write("STEP 5: FEATURE IMPORTANCE (Random Forest)\n")
            f.write("-" * 80 + "\n")
            
            if 'random_forest' in self.results and 'feature_importance' in self.results['random_forest']:
                for i, feature in enumerate(self.results['random_forest']['feature_importance'][:10], 1):
                    f.write(f"{i:2d}. {feature['name']:15s} {feature['importance']:.4f}\n")
            
            # Overfitting analysis
            f.write("\n" + "=" * 80 + "\n")
            f.write("STEP 6: OVERFITTING ANALYSIS\n")
            f.write("-" * 80 + "\n")
            
            for model_name in ['logistic_regression', 'random_forest', 'xgboost']:
                if model_name in self.results and 'overfitting_gap' in self.results[model_name]:
                    m = self.results[model_name]
                    gap = m['overfitting_gap']
                    f.write(f"\n{model_name.replace('_', ' ').title()}:\n")
                    f.write(f"  Train Accuracy: {m['train_accuracy']:.4f}\n")
                    f.write(f"  Test Accuracy:  {m['accuracy']:.4f}\n")
                    f.write(f"  Gap: {gap:.2f}%\n")
                    if gap < 5:
                        f.write(f"  Status:  GOOD - Minimal overfitting\n")
                    elif gap < 10:
                        f.write(f"  Status:   MODERATE - Some overfitting\n")
                    else:
                        f.write(f"  Status:  HIGH - Significant overfitting\n")
        
        print(f"Summary saved to: {summary_path}")
        
    def evaluate_all(self):
        """Run complete evaluation."""
        print("\n" + "=" * 60)
        print("AI MODEL EVALUATION & ACCURACY AUDIT")
        print("=" * 60)
        
        # Step 1: Load data
        self.load_data()
        
        # Step 2: Train models
        print("\n TRAINING MODELS")
        print("=" * 60)
        self.train_logistic_regression()
        self.train_random_forest()
        self.train_xgboost()
        
        # Step 3: Cross validation
        self.cross_validate_models()
        
        # Step 4: Generate report
        self.generate_report()
        
        # Step 5: Print summary
        self._print_summary()
        
    def _print_summary(self):
        """Print evaluation summary."""
        print("\n" + "=" * 80)
        print(" EVALUATION SUMMARY")
        print("=" * 80)
        
        print("\n Model Performance:")
        for model_name in ['logistic_regression', 'random_forest', 'xgboost']:
            if model_name in self.results and self.results[model_name]:
                m = self.results[model_name]
                print(f"\n  {model_name.replace('_', ' ').title()}:")
                print(f"    Accuracy:  {m['accuracy']:.4f}")
                print(f"    F1 Score:  {m['f1']:.4f}")
                print(f"    ROC AUC:   {m['roc_auc']:.4f}")
        
        print("\n Best Model Score:")
        best_model = max(
            [(k, v['f1']) for k, v in self.results.items() 
             if k in ['logistic_regression', 'random_forest', 'xgboost'] and v],
            key=lambda x: x[1]
        )
        print(f"    {best_model[0].replace('_', ' ').title()}: {best_model[1]:.4f}")


if __name__ == "__main__":
    evaluator = ModelEvaluator(DATA_PATH)
    evaluator.evaluate_all()
    
    print("\n Evaluation complete!")
    print(f"Results saved to: {OUTPUT_DIR}")

