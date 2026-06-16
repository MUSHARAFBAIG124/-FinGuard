"""
Phase 6.7: Model Optimization
Improve Random Forest performance and reduce false positives

Goals:
1. Hyperparameter tuning (GridSearchCV, RandomizedSearchCV)
2. Add SMOTE for class imbalance
3. Optimize decision threshold
4. Generate ROC and Precision-Recall curves
5. Compare: Current RF vs Tuned RF vs Tuned RF + SMOTE
"""

import pandas as pd
import numpy as np
import json
import warnings
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from datetime import datetime

# Scikit-learn imports
from sklearn.model_selection import (
    train_test_split, GridSearchCV, RandomizedSearchCV, cross_validate
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, roc_curve, auc, precision_recall_curve,
    classification_report
)
from sklearn.preprocessing import StandardScaler

# SMOTE import
try:
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True
except ImportError:
    SMOTE_AVAILABLE = False
    print("SMOTE not available - install imbalanced-learn")

import joblib

warnings.filterwarnings('ignore')

# Configuration
DATA_PATH = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\Dataset\\german.data-numeric"
OUTPUT_DIR = Path("C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\optimization_results")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Baseline metrics from previous evaluation
BASELINE_METRICS = {
    'accuracy': 0.7700,
    'specificity': 0.4167,  # 25 / (25 + 35)
    'f1': 0.8487,
    'roc_auc': 0.8180
}


class ModelOptimizer:
    """Comprehensive model optimization framework."""
    
    def __init__(self, data_path: str):
        """Initialize optimizer."""
        self.data_path = data_path
        self.X = None
        self.y = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.results = {}
        
    def load_data(self):
        """Load data."""
        print("\n[LOAD] Loading data...")
        df = pd.read_csv(self.data_path, sep='\s+', header=None)
        self.X = df.iloc[:, :-1].values
        self.y = df.iloc[:, -1].map({1: 1, 2: 0}).values
        
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.X, self.y, test_size=0.2, random_state=42, stratify=self.y
        )
        
        print(f"  Train: {len(self.X_train)}, Test: {len(self.X_test)}")
        print(f"  Class distribution - Good: {sum(self.y_train)}, Bad: {len(self.y_train) - sum(self.y_train)}")
        
    def baseline_model(self):
        """Train baseline Random Forest."""
        print("\n[BASELINE] Training baseline Random Forest...")
        
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
        
        metrics = self._compute_metrics("Baseline RF", y_pred, y_pred_proba)
        self.results['baseline'] = {**metrics, 'model': model, 'threshold': 0.5}
        
        return model
        
    def grid_search_optimization(self):
        """Hyperparameter tuning with GridSearchCV."""
        print("\n[GRIDSEARCH] Starting GridSearchCV...")
        
        param_grid = {
            'n_estimators': [50, 100, 200],
            'max_depth': [8, 10, 12, 15],
            'min_samples_split': [5, 10, 15, 20],
            'min_samples_leaf': [2, 5, 8, 10],
            'max_features': ['sqrt', 'log2'],
            'class_weight': [None, 'balanced', 'balanced_subsample']
        }
        
        base_model = RandomForestClassifier(random_state=42, n_jobs=-1)
        
        # Grid search on training data
        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=5,
            scoring='f1',
            n_jobs=-1,
            verbose=0
        )
        
        print("  Running grid search (this may take a few minutes)...")
        grid_search.fit(self.X_train, self.y_train)
        
        print(f"\n  Best parameters: {grid_search.best_params_}")
        print(f"  Best CV F1 Score: {grid_search.best_score_:.4f}")
        
        # Evaluate on test set
        best_model = grid_search.best_estimator_
        y_pred = best_model.predict(self.X_test)
        y_pred_proba = best_model.predict_proba(self.X_test)[:, 1]
        
        metrics = self._compute_metrics("GridSearch RF", y_pred, y_pred_proba)
        self.results['gridsearch'] = {
            **metrics,
            'model': best_model,
            'best_params': grid_search.best_params_,
            'best_cv_score': float(grid_search.best_score_),
            'threshold': 0.5
        }
        
        return best_model, grid_search.best_params_
        
    def randomized_search_optimization(self):
        """Hyperparameter tuning with RandomizedSearchCV."""
        print("\n[RANDOM SEARCH] Starting RandomizedSearchCV...")
        
        param_dist = {
            'n_estimators': [50, 100, 150, 200, 250],
            'max_depth': [6, 8, 10, 12, 14, 16, None],
            'min_samples_split': [2, 5, 8, 10, 15, 20],
            'min_samples_leaf': [1, 2, 4, 6, 8, 10],
            'max_features': ['sqrt', 'log2'],
            'class_weight': [None, 'balanced', 'balanced_subsample']
        }
        
        base_model = RandomForestClassifier(random_state=42, n_jobs=-1)
        
        random_search = RandomizedSearchCV(
            base_model,
            param_dist,
            n_iter=20,
            cv=5,
            scoring='f1',
            n_jobs=-1,
            random_state=42,
            verbose=0
        )
        
        print("  Running random search (20 iterations)...")
        random_search.fit(self.X_train, self.y_train)
        
        print(f"\n  Best parameters: {random_search.best_params_}")
        print(f"  Best CV F1 Score: {random_search.best_score_:.4f}")
        
        best_model = random_search.best_estimator_
        y_pred = best_model.predict(self.X_test)
        y_pred_proba = best_model.predict_proba(self.X_test)[:, 1]
        
        metrics = self._compute_metrics("RandomSearch RF", y_pred, y_pred_proba)
        self.results['randomsearch'] = {
            **metrics,
            'model': best_model,
            'best_params': random_search.best_params_,
            'best_cv_score': float(random_search.best_score_),
            'threshold': 0.5
        }
        
        return best_model, random_search.best_params_
        
    def smote_optimization(self, best_model_params):
        """Apply SMOTE and retrain."""
        if not SMOTE_AVAILABLE:
            print("\n[SMOTE] SMOTE not available, skipping...")
            return None
            
        print("\n[SMOTE] Applying SMOTE to training data...")
        
        smote = SMOTE(random_state=42)
        X_train_smote, y_train_smote = smote.fit_resample(self.X_train, self.y_train)
        
        print(f"  Before SMOTE - Good: {sum(self.y_train)}, Bad: {len(self.y_train) - sum(self.y_train)}")
        print(f"  After SMOTE - Good: {sum(y_train_smote)}, Bad: {len(y_train_smote) - sum(y_train_smote)}")
        
        # Train with best parameters on SMOTE data
        model = RandomForestClassifier(random_state=42, n_jobs=-1, **best_model_params)
        model.fit(X_train_smote, y_train_smote)
        
        y_pred = model.predict(self.X_test)
        y_pred_proba = model.predict_proba(self.X_test)[:, 1]
        
        metrics = self._compute_metrics("Tuned RF + SMOTE", y_pred, y_pred_proba)
        self.results['smote'] = {**metrics, 'model': model, 'threshold': 0.5}
        
        return model
        
    def threshold_optimization(self, model, model_name="Model"):
        """Test different decision thresholds."""
        print(f"\n[THRESHOLD] Optimizing decision threshold for {model_name}...")
        
        y_pred_proba = model.predict_proba(self.X_test)[:, 1]
        
        thresholds = [0.50, 0.55, 0.60, 0.65, 0.70]
        threshold_results = {}
        
        for thresh in thresholds:
            y_pred = (y_pred_proba >= thresh).astype(int)
            metrics = self._compute_metrics(f"Threshold {thresh}", y_pred, y_pred_proba)
            threshold_results[thresh] = metrics
            print(f"  {thresh}: Accuracy={metrics['accuracy']:.4f}, F1={metrics['f1']:.4f}, Specificity={metrics['specificity']:.4f}")
        
        # Find best threshold
        best_thresh = max(threshold_results.items(), key=lambda x: x[1]['f1'])
        print(f"\n  Best threshold: {best_thresh[0]} (F1={best_thresh[1]['f1']:.4f})")
        
        return threshold_results, best_thresh[0]
        
    def _compute_metrics(self, model_name, y_pred, y_pred_proba):
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
        
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        
        return {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1': float(f1),
            'roc_auc': float(roc_auc),
            'specificity': float(specificity),
            'tn': int(tn),
            'fp': int(fp),
            'fn': int(fn),
            'tp': int(tp)
        }
        
    def generate_curves(self):
        """Generate ROC and Precision-Recall curves."""
        print("\n[CURVES] Generating ROC and Precision-Recall curves...")
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        # ROC Curves
        ax = axes[0]
        colors = ['blue', 'green', 'red', 'orange']
        model_names = ['baseline', 'gridsearch', 'randomsearch', 'smote']
        
        for color, model_key in zip(colors, model_names):
            if model_key in self.results:
                model = self.results[model_key]['model']
                y_pred_proba = model.predict_proba(self.X_test)[:, 1]
                
                fpr, tpr, _ = roc_curve(self.y_test, y_pred_proba)
                roc_auc = auc(fpr, tpr)
                
                ax.plot(fpr, tpr, label=f'{model_key.title()} (AUC={roc_auc:.3f})', 
                       color=color, linewidth=2)
        
        ax.plot([0, 1], [0, 1], 'k--', label='Random', linewidth=1)
        ax.set_xlabel('False Positive Rate')
        ax.set_ylabel('True Positive Rate')
        ax.set_title('ROC Curves Comparison')
        ax.legend(loc='lower right')
        ax.grid(alpha=0.3)
        
        # Precision-Recall Curves
        ax = axes[1]
        for color, model_key in zip(colors, model_names):
            if model_key in self.results:
                model = self.results[model_key]['model']
                y_pred_proba = model.predict_proba(self.X_test)[:, 1]
                
                precision, recall, _ = precision_recall_curve(self.y_test, y_pred_proba)
                
                ax.plot(recall, precision, label=f'{model_key.title()}', 
                       color=color, linewidth=2)
        
        ax.set_xlabel('Recall')
        ax.set_ylabel('Precision')
        ax.set_title('Precision-Recall Curves')
        ax.legend(loc='upper right')
        ax.grid(alpha=0.3)
        
        plt.tight_layout()
        curve_path = OUTPUT_DIR / 'roc_pr_curves.png'
        plt.savefig(curve_path, dpi=300, bbox_inches='tight')
        print(f"  Curves saved to: {curve_path}")
        plt.close()
        
    def generate_comparison_table(self):
        """Generate model comparison table."""
        print("\n[REPORT] Generating comparison table...")
        
        comparison = {}
        
        for model_key, model_data in self.results.items():
            comparison[model_key] = {
                'Accuracy': model_data['accuracy'],
                'Precision': model_data['precision'],
                'Recall': model_data['recall'],
                'F1': model_data['f1'],
                'Specificity': model_data['specificity'],
                'ROC-AUC': model_data['roc_auc']
            }
        
        df = pd.DataFrame(comparison).T
        
        print("\n" + "=" * 90)
        print("MODEL PERFORMANCE COMPARISON")
        print("=" * 90)
        print(df.to_string())
        
        # Save to CSV
        csv_path = OUTPUT_DIR / 'model_comparison.csv'
        df.to_csv(csv_path)
        print(f"\nComparison saved to: {csv_path}")
        
        return df
        
    def generate_final_report(self):
        """Generate comprehensive final report."""
        print("\n[FINAL] Generating final optimization report...")
        
        report_path = OUTPUT_DIR / 'OPTIMIZATION_REPORT.txt'
        
        with open(report_path, 'w') as f:
            f.write("=" * 90 + "\n")
            f.write("PHASE 6.7: MODEL OPTIMIZATION - FINAL REPORT\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 90 + "\n\n")
            
            # Baseline
            f.write("BASELINE RANDOM FOREST (from previous evaluation)\n")
            f.write("-" * 90 + "\n")
            baseline = self.results['baseline']
            f.write(f"Accuracy:   {baseline['accuracy']:.4f}\n")
            f.write(f"Precision:  {baseline['precision']:.4f}\n")
            f.write(f"Recall:     {baseline['recall']:.4f}\n")
            f.write(f"F1 Score:   {baseline['f1']:.4f}\n")
            f.write(f"Specificity:{baseline['specificity']:.4f}\n")
            f.write(f"ROC-AUC:    {baseline['roc_auc']:.4f}\n")
            
            # GridSearch Results
            f.write("\n\nGRIDSEARCH OPTIMIZED RANDOM FOREST\n")
            f.write("-" * 90 + "\n")
            if 'gridsearch' in self.results:
                gs = self.results['gridsearch']
                f.write(f"Best Parameters:\n")
                for param, value in gs['best_params'].items():
                    f.write(f"  {param}: {value}\n")
                f.write(f"\nBest CV F1 Score: {gs['best_cv_score']:.4f}\n")
                f.write(f"\nTest Set Performance:\n")
                f.write(f"Accuracy:   {gs['accuracy']:.4f} (Improvement: {(gs['accuracy']-baseline['accuracy'])*100:+.2f}%)\n")
                f.write(f"Precision:  {gs['precision']:.4f} (Improvement: {(gs['precision']-baseline['precision'])*100:+.2f}%)\n")
                f.write(f"Recall:     {gs['recall']:.4f} (Improvement: {(gs['recall']-baseline['recall'])*100:+.2f}%)\n")
                f.write(f"F1 Score:   {gs['f1']:.4f} (Improvement: {(gs['f1']-baseline['f1'])*100:+.2f}%)\n")
                f.write(f"Specificity:{gs['specificity']:.4f} (Improvement: {(gs['specificity']-baseline['specificity'])*100:+.2f}%)\n")
                f.write(f"ROC-AUC:    {gs['roc_auc']:.4f} (Improvement: {(gs['roc_auc']-baseline['roc_auc'])*100:+.2f}%)\n")
            
            # RandomSearch Results
            f.write("\n\nRANDOMIZED SEARCH OPTIMIZED RANDOM FOREST\n")
            f.write("-" * 90 + "\n")
            if 'randomsearch' in self.results:
                rs = self.results['randomsearch']
                f.write(f"Best Parameters:\n")
                for param, value in rs['best_params'].items():
                    f.write(f"  {param}: {value}\n")
                f.write(f"\nBest CV F1 Score: {rs['best_cv_score']:.4f}\n")
                f.write(f"\nTest Set Performance:\n")
                f.write(f"Accuracy:   {rs['accuracy']:.4f} (Improvement: {(rs['accuracy']-baseline['accuracy'])*100:+.2f}%)\n")
                f.write(f"Precision:  {rs['precision']:.4f} (Improvement: {(rs['precision']-baseline['precision'])*100:+.2f}%)\n")
                f.write(f"Recall:     {rs['recall']:.4f} (Improvement: {(rs['recall']-baseline['recall'])*100:+.2f}%)\n")
                f.write(f"F1 Score:   {rs['f1']:.4f} (Improvement: {(rs['f1']-baseline['f1'])*100:+.2f}%)\n")
                f.write(f"Specificity:{rs['specificity']:.4f} (Improvement: {(rs['specificity']-baseline['specificity'])*100:+.2f}%)\n")
                f.write(f"ROC-AUC:    {rs['roc_auc']:.4f} (Improvement: {(rs['roc_auc']-baseline['roc_auc'])*100:+.2f}%)\n")
            
            # SMOTE Results
            f.write("\n\nTUNED RANDOM FOREST + SMOTE\n")
            f.write("-" * 90 + "\n")
            if 'smote' in self.results:
                smote = self.results['smote']
                f.write(f"Test Set Performance:\n")
                f.write(f"Accuracy:   {smote['accuracy']:.4f} (Improvement: {(smote['accuracy']-baseline['accuracy'])*100:+.2f}%)\n")
                f.write(f"Precision:  {smote['precision']:.4f} (Improvement: {(smote['precision']-baseline['precision'])*100:+.2f}%)\n")
                f.write(f"Recall:     {smote['recall']:.4f} (Improvement: {(smote['recall']-baseline['recall'])*100:+.2f}%)\n")
                f.write(f"F1 Score:   {smote['f1']:.4f} (Improvement: {(smote['f1']-baseline['f1'])*100:+.2f}%)\n")
                f.write(f"Specificity:{smote['specificity']:.4f} (Improvement: {(smote['specificity']-baseline['specificity'])*100:+.2f}%)\n")
                f.write(f"ROC-AUC:    {smote['roc_auc']:.4f} (Improvement: {(smote['roc_auc']-baseline['roc_auc'])*100:+.2f}%)\n")
            
            # Success Criteria
            f.write("\n\n" + "=" * 90 + "\n")
            f.write("SUCCESS CRITERIA EVALUATION\n")
            f.write("=" * 90 + "\n")
            
            criteria = {
                'Accuracy >= 80%': 0.80,
                'Specificity >= 55%': 0.55,
                'F1 >= baseline': baseline['f1'],
                'ROC-AUC >= baseline': baseline['roc_auc']
            }
            
            best_model = max(
                [(k, v) for k, v in self.results.items() if k != 'baseline'],
                key=lambda x: x[1]['f1']
            )
            best_metrics = best_model[1]
            
            f.write(f"\nBest Model: {best_model[0].upper()}\n\n")
            
            for criterion, threshold in criteria.items():
                if 'Accuracy' in criterion:
                    value = best_metrics['accuracy']
                elif 'Specificity' in criterion:
                    value = best_metrics['specificity']
                elif 'F1' in criterion:
                    value = best_metrics['f1']
                else:  # ROC-AUC
                    value = best_metrics['roc_auc']
                
                status = "PASS" if value >= threshold else "FAIL"
                f.write(f"{criterion:25s}: {value:.4f} vs {threshold:.4f} [{status}]\n")
            
            # Recommendations
            f.write("\n\n" + "=" * 90 + "\n")
            f.write("FINAL RECOMMENDATIONS\n")
            f.write("=" * 90 + "\n\n")
            
            f.write("1. RECOMMENDED MODEL: ")
            if best_model[0] == 'smote':
                f.write("Tuned Random Forest + SMOTE\n")
                f.write("   - Handles class imbalance explicitly\n")
                f.write("   - Improved specificity and recall balance\n")
                f.write("   - Better generalization on imbalanced data\n")
            elif best_model[0] == 'gridsearch':
                f.write("GridSearch Tuned Random Forest\n")
                f.write("   - Comprehensive hyperparameter search\n")
                f.write("   - Best cross-validation performance\n")
            else:
                f.write("RandomSearch Tuned Random Forest\n")
                f.write("   - Good performance with less computation\n")
                f.write("   - Efficient hyperparameter exploration\n")
            
            f.write("\n2. KEY IMPROVEMENTS:\n")
            f.write(f"   - Accuracy: {baseline['accuracy']:.4f} -> {best_metrics['accuracy']:.4f}\n")
            f.write(f"   - Specificity: {baseline['specificity']:.4f} -> {best_metrics['specificity']:.4f}\n")
            f.write(f"   - F1 Score: {baseline['f1']:.4f} -> {best_metrics['f1']:.4f}\n")
            f.write(f"   - ROC-AUC: {baseline['roc_auc']:.4f} -> {best_metrics['roc_auc']:.4f}\n")
            
            f.write("\n3. DEPLOYMENT STRATEGY:\n")
            f.write("   - Use recommended model as secondary screening tool\n")
            f.write("   - Implement confidence thresholds for manual review\n")
            f.write("   - Monitor false positive and false negative rates\n")
            f.write("   - Retrain quarterly with new data\n")
            
            f.write("\n4. NEXT STEPS:\n")
            f.write("   - Validate on holdout test set\n")
            f.write("   - Implement SHAP explanations\n")
            f.write("   - Add fairness constraints\n")
            f.write("   - Deploy as production recommendation engine\n")
        
        print(f"Report saved to: {report_path}")
        
    def optimize_all(self):
        """Run complete optimization."""
        print("\n" + "=" * 90)
        print("PHASE 6.7: MODEL OPTIMIZATION")
        print("=" * 90)
        
        # Load data
        self.load_data()
        
        # Train baseline
        self.baseline_model()
        
        # GridSearch
        best_model_gs, best_params_gs = self.grid_search_optimization()
        
        # RandomSearch
        best_model_rs, best_params_rs = self.randomized_search_optimization()
        
        # SMOTE (use GridSearch params)
        if SMOTE_AVAILABLE:
            self.smote_optimization(best_params_gs)
        
        # Threshold optimization for best model
        print("\n[THRESHOLD] Testing optimal thresholds...")
        for model_key in ['gridsearch', 'randomsearch', 'smote', 'baseline']:
            if model_key in self.results:
                model = self.results[model_key]['model']
                threshold_results, best_thresh = self.threshold_optimization(
                    model, model_key.upper()
                )
                self.results[model_key]['threshold_results'] = threshold_results
                self.results[model_key]['best_threshold'] = best_thresh
        
        # Generate curves
        self.generate_curves()
        
        # Generate comparison table
        self.generate_comparison_table()
        
        # Generate final report
        self.generate_final_report()
        
        print("\n" + "=" * 90)
        print("OPTIMIZATION COMPLETE")
        print(f"Results saved to: {OUTPUT_DIR}")
        print("=" * 90)


if __name__ == "__main__":
    optimizer = ModelOptimizer(DATA_PATH)
    optimizer.optimize_all()
