#include <stdio.h>
#include <stdlib.h>

#define MAX_SIZE 1001

// 最小堆结构体
typedef struct {
    int data[MAX_SIZE];
    int size;
} MinHeap;

// 初始化最小堆
void InitHeap(MinHeap *heap) {
    heap->size = 0;
}

// 插入元素到堆
void InsertHeap(MinHeap *heap, int value) {
    if (heap->size >= MAX_SIZE - 1) {
        return;
    }
    
    int i = ++heap->size;
    // 向上调整
    while (i > 1 && value < heap->data[i / 2]) {
        heap->data[i] = heap->data[i / 2];
        i /= 2;
    }
    heap->data[i] = value;
}

// 删除并返回堆顶元素
int DeleteHeap(MinHeap *heap) {
    if (heap->size == 0) {
        return -1;
    }
    
    int min_val = heap->data[1];
    int last_val = heap->data[heap->size--];
    int i = 1;
    int j = 2;
    
    // 向下调整
    while (j <= heap->size) {
        if (j < heap->size && heap->data[j] > heap->data[j + 1]) {
            j++;
        }
        if (last_val <= heap->data[j]) {
            break;
        }
        heap->data[i] = heap->data[j];
        i = j;
        j *= 2;
    }
    heap->data[i] = last_val;
    
    return min_val;
}

// 计算哈夫曼树的带权路径长度
int CalculateHuffmanWPL(int weights[], int n) {
    MinHeap heap;
    InitHeap(&heap);
    
    // 将所有权值插入堆
    for (int i = 0; i < n; i++) {
        InsertHeap(&heap, weights[i]);
    }
    
    int total_wpl = 0;
    
    // 构建哈夫曼树
    while (heap.size > 1) {
        // 取出两个最小权值
        int min1 = DeleteHeap(&heap);
        int min2 = DeleteHeap(&heap);
        
        // 合并节点
        int merged = min1 + min2;
        
        // 累加到WPL
        total_wpl += merged;
        
        // 将合并后的节点放回堆
        InsertHeap(&heap, merged);
    }
    
    return total_wpl;
}

int main() {
    int n;
    int weights[MAX_SIZE];
    
    // 读取输入
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        scanf("%d", &weights[i]);
    }
    
    // 计算并输出结果
    int wpl = CalculateHuffmanWPL(weights, n);
    printf("%d\n", wpl);
    
    return 0;
}