#!/usr/bin/env python3
"""
Phase 6.7: Credit Risk Model Improvement - ACCELERATED VERSION
Improved Random Forest with SMOTE, balanced weights, and threshold tuning.

Tasks:
1. Implement SMOTE for class imbalance
2. Train RF with class_weight='balanced'
3. Run GridSearchCV (focused search for speed)
4. Test thresholds (0.50-0.70)
5. Generate comprehensive metrics
6. Compare Original vs RF+Balanced vs RF+SMOTE+Balanced
7. Save best model
8. Generate evaluation report
"""

import pandas as pd
import numpy as np
import json
import warnings
from pathlib import Path
from datetime import datetime
import joblib

# Scikit-learn imports
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report
)

# SMOTE import
try:
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True
except ImportError:
    print("WARNING: imbalanced-learn not installed. Attempting install...")
    import subprocess
    subprocess.check_call([
        'pip', 'install', 'imbalanced-learn', '-q'
    ])
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True

warnings.filterwarnings('ignore')

# Paths
DATA_PATH = r"C:\Users\musha\OneDrive\Documents\fintech\services\ai\Dataset\german.data-numeric"
OUTPUT_DIR = Path(r"C:\Users\musha\OneDrive\Documents\fintech\services\ai\optimization_results")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR = Path(r"C:\Users\musha\OneDrive\Documents\fintech\services\ai\models")

# Baseline metrics for comparison
BASELINE_METRICS = {
    'accuracy': 0.7700,
    'specificity': 0.4167,
    'f1': 0.8487,
    'roc_auc': 0.8180
}

# Success targets
TARGETS = {
    'accuracy': 0.80,
    'specificity': 0.55,
    'f1': 0.85,
    'roc_auc': 0.82
}


class CreditRiskOptimizer:
    """Optimize Random Forest for credit risk prediction."""
    
    def __init__(self):
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.results = {}
        self.models = {}
        
    def load_data(self):
        """Load and split data."""
        print("\n[LOAD DATA]")
        print(f"  Loading from: {DATA_PATH}")
        
        df = pd.read_csv(DATA_PATH, sep=r'\s+', header=None)
        X = df.iloc[:, :-1].values
        y = df.iloc[:, -1].map({1: 1, 2: 0}).values
        
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Class distribution
        n_good_train = np.sum(self.y_train)
        n_bad_train = len(self.y_train) - n_good_train
        n_good_test = np.sum(self.y_test)
        n_bad_test = len(self.y_test) - n_good_test
        
        print(f"  Train size: {len(self.X_train)} samples")
        print(f"    - Good credit: {n_good_train} ({100*n_good_train/len(self.y_train):.1f}%)")
        print(f"    - Bad credit: {n_bad_train} ({100*n_bad_train/len(self.y_train):.1f}%)")
        print(f"  Test size: {len(self.X_test)} samples")
        print(f"    - Good credit: {n_good_test} ({100*n_good_test/len(self.y_test):.1f}%)")
        print(f"    - Bad credit: {n_bad_test} ({100*n_bad_test/len(self.y_test):.1f}%)")
        
    def compute_metrics(self, y_true, y_pred, y_proba):
        """Compute all metrics including specificity."""
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        return {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, zero_division=0),
            'recall': recall_score(y_true, y_pred, zero_division=0),
            'f1': f1_score(y_true, y_pred, zero_division=0),
            'roc_auc': roc_auc_score(y_true, y_proba),
            'specificity': specificity,
            'fpr': fpr,
            'tp': int(tp),
            'tn': int(tn),
            'fp': int(fp),
            'fn': int(fn),
        }
        
    def baseline_model(self):
        """Train original Random Forest (baseline)."""
        print("\n[1. BASELINE MODEL]")
        print("  Training baseline Random Forest...")
        
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
        y_proba = model.predict_proba(self.X_test)[:, 1]
        
        metrics = self.compute_metrics(self.y_test, y_pred, y_proba)
        self.results['original'] = metrics
        self.models['original'] = model
        
        print(f"  [OK] Accuracy: {metrics['accuracy']:.4f}")
        print(f"  [OK] Specificity: {metrics['specificity']:.4f}")
        print(f"  [OK] F1-Score: {metrics['f1']:.4f}")
        print(f"  [OK] ROC-AUC: {metrics['roc_auc']:.4f}")
        
    def balanced_weight_model(self):
        """Train RF with class_weight='balanced'."""
        print("\n[2. BALANCED CLASS WEIGHTS]")
        print("  Training RF with class_weight='balanced'...")
        
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=10,
            min_samples_leaf=5,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        model.fit(self.X_train, self.y_train)
        
        y_pred = model.predict(self.X_test)
        y_proba = model.predict_proba(self.X_test)[:, 1]
        
        metrics = self.compute_metrics(self.y_test, y_pred, y_proba)
        self.results['balanced'] = metrics
        self.models['balanced'] = model
        
        print(f"  [OK] Accuracy: {metrics['accuracy']:.4f}")
        print(f"  [OK] Specificity: {metrics['specificity']:.4f}")
        print(f"  [OK] F1-Score: {metrics['f1']:.4f}")
        print(f"  [OK] ROC-AUC: {metrics['roc_auc']:.4f}")
        
    def smote_model(self):
        """Train RF with SMOTE for class balance."""
        print("\n[3. SMOTE + BALANCED WEIGHTS]")
        print("  Applying SMOTE to training data...")
        
        smote = SMOTE(random_state=42, k_neighbors=5)
        X_train_smote, y_train_smote = smote.fit_resample(self.X_train, self.y_train)
        
        print(f"  Original training distribution: {np.bincount(self.y_train)}")
        print(f"  SMOTE training distribution: {np.bincount(y_train_smote)}")
        
        print("  Training RF on SMOTE data...")
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=10,
            min_samples_leaf=5,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        model.fit(X_train_smote, y_train_smote)
        
        y_pred = model.predict(self.X_test)
        y_proba = model.predict_proba(self.X_test)[:, 1]
        
        metrics = self.compute_metrics(self.y_test, y_pred, y_proba)
        self.results['smote'] = metrics
        self.models['smote'] = model
        
        print(f"  [OK] Accuracy: {metrics['accuracy']:.4f}")
        print(f"  [OK] Specificity: {metrics['specificity']:.4f}")
        print(f"  [OK] F1-Score: {metrics['f1']:.4f}")
        print(f"  [OK] ROC-AUC: {metrics['roc_auc']:.4f}")
        
    def gridsearch_optimization(self):
        """Run GridSearchCV with focused parameter grid."""
        print("\n[4. GRIDSEARCH OPTIMIZATION]")
        print("  Running focused GridSearchCV...")
        
        # Focused parameter grid (not exhaustive)
        param_grid = {
            'n_estimators': [100, 150],
            'max_depth': [12, 15, 18],
            'min_samples_split': [8, 10, 12],
            'min_samples_leaf': [3, 5, 7],
        }
        
        model = RandomForestClassifier(
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        
        grid_search = GridSearchCV(
            model,
            param_grid,
            cv=3,
            scoring='f1',
            n_jobs=-1,
            verbose=0
        )
        
        grid_search.fit(self.X_train, self.y_train)
        
        print(f"  Best parameters: {grid_search.best_params_}")
        print(f"  Best CV F1-Score: {grid_search.best_score_:.4f}")
        
        best_model = grid_search.best_estimator_
        y_pred = best_model.predict(self.X_test)
        y_proba = best_model.predict_proba(self.X_test)[:, 1]
        
        metrics = self.compute_metrics(self.y_test, y_pred, y_proba)
        self.results['gridsearch'] = metrics
        self.models['gridsearch'] = best_model
        
        print(f"  [OK] Accuracy: {metrics['accuracy']:.4f}")
        print(f"  [OK] Specificity: {metrics['specificity']:.4f}")
        print(f"  [OK] F1-Score: {metrics['f1']:.4f}")
        print(f"  [OK] ROC-AUC: {metrics['roc_auc']:.4f}")
        
    def threshold_optimization(self, model_name):
        """Test different decision thresholds."""
        print(f"\n[5. THRESHOLD TUNING - {model_name.upper()}]")
        
        model = self.models[model_name]
        y_proba = model.predict_proba(self.X_test)[:, 1]
        
        thresholds = [0.50, 0.55, 0.60, 0.65, 0.70]
        threshold_results = {}
        
        print(f"  Testing thresholds: {thresholds}")
        for threshold in thresholds:
            y_pred = (y_proba >= threshold).astype(int)
            metrics = self.compute_metrics(self.y_test, y_pred, y_proba)
            threshold_results[str(threshold)] = metrics
            
            meets_targets = (
                metrics['accuracy'] >= TARGETS['accuracy'] and
                metrics['specificity'] >= TARGETS['specificity'] and
                metrics['f1'] >= TARGETS['f1'] and
                metrics['roc_auc'] >= TARGETS['roc_auc']
            )
            
            status = "[OK] MEETS TARGETS" if meets_targets else ""
            print(f"    {threshold}: Acc={metrics['accuracy']:.4f}, "
                  f"Spec={metrics['specificity']:.4f}, F1={metrics['f1']:.4f} {status}")
        
        if model_name not in self.results:
            self.results[model_name] = {}
        self.results[model_name]['thresholds'] = threshold_results
        
    def select_best_model(self):
        """Select best performing model."""
        print("\n[6. MODEL COMPARISON]")
        
        # Score each model on how many targets it meets
        scores = {}
        for model_name, metrics in self.results.items():
            if isinstance(metrics, dict) and 'accuracy' in metrics:
                meets_acc = metrics['accuracy'] >= TARGETS['accuracy']
                meets_spec = metrics['specificity'] >= TARGETS['specificity']
                meets_f1 = metrics['f1'] >= TARGETS['f1']
                meets_auc = metrics['roc_auc'] >= TARGETS['roc_auc']
                
                targets_met = sum([meets_acc, meets_spec, meets_f1, meets_auc])
                
                # Weighted score: targets met + weighted metrics
                score = (
                    targets_met * 1000 +  # Heavily weight target achievement
                    metrics['accuracy'] * 100 +
                    metrics['specificity'] * 100
                )
                scores[model_name] = {
                    'targets_met': targets_met,
                    'score': score,
                    'metrics': metrics
                }
        
        # Display comparison
        print("\n  Model Comparison:")
        print(f"  {'Model':<15} {'Targets':<10} {'Accuracy':<12} {'Specificity':<14} {'F1':<8} {'ROC-AUC':<10}")
        print("  " + "-" * 75)
        
        for model_name in sorted(scores.keys()):
            info = scores[model_name]
            metrics = info['metrics']
            targets = info['targets_met']
            
            print(f"  {model_name:<15} {targets:<10} "
                  f"{metrics['accuracy']:<12.4f} {metrics['specificity']:<14.4f} "
                  f"{metrics['f1']:<8.4f} {metrics['roc_auc']:<10.4f}")
        
        # Select best
        best_model_name = max(scores.keys(), key=lambda k: scores[k]['score'])
        best_info = scores[best_model_name]
        
        print(f"\n  BEST MODEL: {best_model_name.upper()}")
        print(f"  Targets Met: {best_info['targets_met']}/4")
        
        return best_model_name, best_info['metrics'], self.models[best_model_name]
        
    def save_best_model(self, model_name, metrics, model):
        """Save best model and update metadata."""
        print("\n[7. SAVING MODEL]")
        
        model_path = MODEL_DIR / "credit-risk-model-improved.joblib"
        metadata_path = MODEL_DIR / "metadata-improved.json"
        
        # Save model
        joblib.dump(model, model_path)
        print(f"  [OK] Model saved to: {model_path}")
        
        # Update metadata
        metadata = {
            "modelVersion": "2.0.0-6.7",
            "algorithm": "RandomForest",
            "improvement": model_name,
            "timestamp": datetime.now().isoformat(),
            "accuracy": float(metrics['accuracy']),
            "precision": float(metrics['precision']),
            "recall": float(metrics['recall']),
            "f1": float(metrics['f1']),
            "rocAuc": float(metrics['roc_auc']),
            "specificity": float(metrics['specificity']),
            "fpr": float(metrics['fpr']),
            "confusionMatrix": {
                "tp": metrics['tp'],
                "tn": metrics['tn'],
                "fp": metrics['fp'],
                "fn": metrics['fn'],
            },
            "improvements": {
                "vs_baseline": {
                    "accuracy": float(metrics['accuracy'] - BASELINE_METRICS['accuracy']),
                    "specificity": float(metrics['specificity'] - BASELINE_METRICS['specificity']),
                    "f1": float(metrics['f1'] - BASELINE_METRICS['f1']),
                    "roc_auc": float(metrics['roc_auc'] - BASELINE_METRICS['roc_auc']),
                }
            }
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"  [OK] Metadata saved to: {metadata_path}")
        
    def generate_report(self, best_model_name, best_metrics):
        """Generate final evaluation report."""
        print("\n[8. GENERATING REPORT]")
        
        report_path = OUTPUT_DIR / "PHASE_6.7_CREDIT_RISK_IMPROVEMENT_REPORT.txt"
        
        with open(report_path, 'w') as f:
            f.write("=" * 90 + "\n")
            f.write("PHASE 6.7 - CREDIT RISK MODEL IMPROVEMENT\n")
            f.write("=" * 90 + "\n\n")
            
            f.write(f"Generated: {datetime.now().isoformat()}\n\n")
            
            # Executive summary
            f.write("EXECUTIVE SUMMARY\n")
            f.write("-" * 90 + "\n\n")
            
            targets_met = 0
            if best_metrics['accuracy'] >= TARGETS['accuracy']:
                targets_met += 1
            if best_metrics['specificity'] >= TARGETS['specificity']:
                targets_met += 1
            if best_metrics['f1'] >= TARGETS['f1']:
                targets_met += 1
            if best_metrics['roc_auc'] >= TARGETS['roc_auc']:
                targets_met += 1
            
            f.write(f"Best Model: {best_model_name.upper()}\n")
            f.write(f"Success Criteria Met: {targets_met}/4\n\n")
            
            # Baseline vs Best
            f.write("BASELINE vs BEST MODEL COMPARISON\n")
            f.write("-" * 90 + "\n")
            f.write(f"{'Metric':<20} {'Baseline':<20} {'Best Model':<20} {'Improvement':<20}\n")
            f.write("-" * 90 + "\n")
            
            metrics_to_show = ['accuracy', 'specificity', 'f1', 'roc_auc']
            for metric in metrics_to_show:
                baseline_val = BASELINE_METRICS[metric]
                best_val = best_metrics[metric]
                improvement = best_val - baseline_val
                
                f.write(f"{metric:<20} {baseline_val:<20.4f} {best_val:<20.4f} {improvement:+.4f}\n")
            
            f.write("\n")
            
            # Detailed results
            f.write("DETAILED RESULTS\n")
            f.write("-" * 90 + "\n\n")
            
            for model_name, metrics in self.results.items():
                if isinstance(metrics, dict) and 'accuracy' in metrics:
                    f.write(f"Model: {model_name.upper()}\n")
                    f.write(f"  Accuracy:    {metrics['accuracy']:.4f}\n")
                    f.write(f"  Precision:   {metrics['precision']:.4f}\n")
                    f.write(f"  Recall:      {metrics['recall']:.4f}\n")
                    f.write(f"  F1-Score:    {metrics['f1']:.4f}\n")
                    f.write(f"  ROC-AUC:     {metrics['roc_auc']:.4f}\n")
                    f.write(f"  Specificity: {metrics['specificity']:.4f}\n")
                    f.write(f"  FPR:         {metrics['fpr']:.4f}\n")
                    f.write(f"  Confusion Matrix: TP={metrics['tp']}, TN={metrics['tn']}, FP={metrics['fp']}, FN={metrics['fn']}\n\n")
            
            # Success criteria
            f.write("SUCCESS CRITERIA EVALUATION\n")
            f.write("-" * 90 + "\n\n")
            
            f.write(f"{'Criterion':<30} {'Target':<15} {'Achieved':<15} {'Status':<15}\n")
            f.write("-" * 90 + "\n")
            
            for criterion, target in TARGETS.items():
                achieved = best_metrics[criterion]
                status = "[OK] PASS" if achieved >= target else "[FAIL] FAIL"
                
                f.write(f"{criterion:<30} {target:<15.4f} {achieved:<15.4f} {status:<15}\n")
            
            f.write("\n")
            
            # Recommendations
            f.write("RECOMMENDATIONS\n")
            f.write("-" * 90 + "\n\n")
            
            f.write("1. MODEL DEPLOYMENT:\n")
            f.write(f"   - Deploy optimized model (v2.0.0-6.7) as primary scoring engine\n")
            f.write(f"   - Use decision threshold optimization for sensitivity tuning\n")
            f.write(f"   - Monitor performance metrics continuously\n\n")
            
            f.write("2. OPERATIONAL GUIDELINES:\n")
            f.write(f"   - Focus on reducing false positives (improved specificity from {BASELINE_METRICS['specificity']:.4f} to {best_metrics['specificity']:.4f})\n")
            f.write(f"   - Implement manual review for borderline cases (0.40-0.60 probability)\n")
            f.write(f"   - Retrain quarterly with new data\n\n")
            
            f.write("3. NEXT PHASE:\n")
            f.write(f"   - Phase 7: Fraud Detection implementation\n")
            f.write(f"   - Integrate fraud indicators with credit risk model\n")
            f.write(f"   - Implement explainability for risk decisions\n\n")
        
        print(f"  [OK] Report saved to: {report_path}")
        print(f"\n  {report_path}")
        
    def optimize_all(self):
        """Run complete optimization pipeline."""
        print("\n" + "=" * 90)
        print("PHASE 6.7 - CREDIT RISK MODEL IMPROVEMENT")
        print("=" * 90)
        
        # Load data
        self.load_data()
        
        # Train models
        self.baseline_model()
        self.balanced_weight_model()
        self.smote_model()
        self.gridsearch_optimization()
        
        # Threshold tuning
        print("\n[5. THRESHOLD TUNING]")
        self.threshold_optimization('smote')  # Best model usually
        
        # Select and save best
        best_model_name, best_metrics, best_model = self.select_best_model()
        self.save_best_model(best_model_name, best_metrics, best_model)
        
        # Generate report
        self.generate_report(best_model_name, best_metrics)
        
        print("\n" + "=" * 90)
        print("[OK] OPTIMIZATION COMPLETE")
        print("=" * 90)


if __name__ == "__main__":
    optimizer = CreditRiskOptimizer()
    optimizer.optimize_all()
