public class Main {
    public static void main(String[] args) {
        int[] route = {1, 3};
        for (int i = 0; i < 2; i++) {
            for (int n = 0; n < route[i]; n++) {
                move();
            }
        }
    }
}
